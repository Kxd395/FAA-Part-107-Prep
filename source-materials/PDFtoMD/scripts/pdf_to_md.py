#!/usr/bin/env python3
"""Convert OCR PDFs to LLM-ready markdown with page citations and extracted images."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import fitz


EXPECTED_PRIMARY_FILES = {
    "uas_acsocr.pdf": "P0",
    "remote_pilot_study_guideocr.pdf": "P1",
    "sport_rec_private_aktsocr.pdf": "P1",
    "spa_questionsocr.pdf": "P2",
    "uag_questionsocr.pdf": "P2",
    "faa part 107 study guideocr.pdf": "P2",
    "csgis_instruction_for_faa_part_107_examinationocr.pdf": "P3",
    "part_107_pso_so_checklistocr.pdf": "P3",
}


@dataclass
class DocSummary:
    file_name: str
    markdown_path: Path
    metadata_path: Path
    pages: int
    text_chars: int
    images_saved: int
    relevance_rank: str
    relevance_reason: str


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    text = re.sub(r"-{2,}", "-", text).strip("-")
    return text or "document"


def normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.lower()).strip()


def rank_document(file_name: str) -> tuple[str, str]:
    n = normalize_name(file_name)
    if "ac_107-2a" in n or "ac 107-2a" in n:
        return ("P0", "Primary FAA advisory guidance for Part 107 operations.")
    if "uas_acs" in n:
        return ("P0", "Authoritative test blueprint (knowledge codes and scope).")
    if "part 107" in n and "ecfr" in n:
        return ("P0", "Primary legal text for Part 107.")
    if "part 89" in n and "ecfr" in n:
        return ("P0", "Primary legal text for Remote ID requirements.")
    if "remote_pilot_study_guide" in n:
        return ("P1", "Primary instructional content for Part 107 concepts.")
    if "akts" in n or "testing supplement" in n:
        return ("P1", "Figure/chart source for map and diagram-based questions.")
    if "learningstatementreferenceguide" in n:
        return ("P1", "Maps missed question codes to remediation study content.")
    if "uas_testing_information" in n:
        return ("P1", "FAA summary of Remote ID/night/OOP testing updates.")
    if "testing_matrix" in n:
        return ("P2", "Current FAA testing/admin matrix for scheduling constraints.")
    if "cug-complete" in n:
        return ("P2", "Aeronautical chart interpretation reference for figure questions.")
    if "8083-28a" in n or "aviation-weather-handbook" in n:
        return ("P2", "Current weather reference for coded weather and effects questions.")
    if "8083-25c" in n or "phak" in n:
        return ("P3", "Broad pilot knowledge reference; use only Part 107-relevant sections.")
    if "spa_questions" in n or "uag_questions" in n:
        return ("P2", "Seed practice questions for style and distractor patterns.")
    if "faa part 107 study guide" in n:
        return ("P2", "Supplemental explanations and cross-check content.")
    if "csgis_instruction" in n:
        return ("P3", "Exam process context, low value for scored content questions.")
    if "checklist" in n:
        return ("P3", "Operational checklist content; narrow exam coverage value.")
    return ("P4", "Unclassified source; review manually before heavy use.")


def extract_page_images(
    page: fitz.Page,
    image_output_dir: Path,
    min_width: int,
    min_height: int,
    max_area_ratio: float,
    allow_large_images: bool,
) -> list[dict]:
    image_output_dir.mkdir(parents=True, exist_ok=True)
    page_dict = page.get_text("dict")
    page_area = page.rect.width * page.rect.height if page.rect.width and page.rect.height else 1.0
    saved_images = []
    seen_hashes: set[str] = set()

    for block in page_dict.get("blocks", []):
        if block.get("type") != 1:
            continue

        width = int(block.get("width", 0))
        height = int(block.get("height", 0))
        if width < min_width or height < min_height:
            continue

        x0, y0, x1, y1 = block.get("bbox", (0, 0, 0, 0))
        block_area = max(0.0, (x1 - x0) * (y1 - y0))
        area_ratio = block_area / page_area if page_area else 0.0
        if area_ratio > max_area_ratio and not allow_large_images:
            continue

        image_bytes = block.get("image")
        if not image_bytes:
            continue

        digest = hashlib.sha1(image_bytes).hexdigest()[:12]
        if digest in seen_hashes:
            continue
        seen_hashes.add(digest)

        ext = block.get("ext", "png").lower()
        if ext not in {"png", "jpg", "jpeg"}:
            ext = "png"
        file_name = f"p{page.number + 1:03d}_img{len(saved_images) + 1:02d}_{digest}.{ext}"
        output_path = image_output_dir / file_name
        output_path.write_bytes(image_bytes)

        saved_images.append(
            {
                "file_name": file_name,
                "width": width,
                "height": height,
                "bbox": [round(float(x0), 2), round(float(y0), 2), round(float(x1), 2), round(float(y1), 2)],
                "bbox_area_ratio": round(area_ratio, 4),
            }
        )

    return saved_images


def convert_pdf(
    pdf_path: Path,
    markdown_root: Path,
    image_root: Path,
    metadata_root: Path,
    min_width: int,
    min_height: int,
    max_area_ratio: float,
    large_image_name_regex: re.Pattern[str] | None,
    keep_large_images: bool,
) -> DocSummary:
    slug = slugify(pdf_path.stem)
    markdown_path = markdown_root / f"{slug}.md"
    image_dir = image_root / slug
    metadata_path = metadata_root / f"{slug}.json"

    doc = fitz.open(pdf_path)
    pages_meta = []
    total_text_chars = 0
    total_images = 0

    rank, reason = rank_document(pdf_path.name)
    allow_large_images = keep_large_images or (
        large_image_name_regex is not None and bool(large_image_name_regex.search(pdf_path.name.lower()))
    )
    md_lines = [
        f"# {pdf_path.stem}",
        "",
        f"- Source file: `{pdf_path.name}`",
        f"- Total pages: {doc.page_count}",
        f"- Relevance: {rank} ({reason})",
        f"- Large images kept: {allow_large_images}",
        f"- Generated UTC: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Each page section below includes extracted text and linked page-clipped images.",
        "",
    ]

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        raw_text = page.get_text("text")
        text = raw_text.strip()
        total_text_chars += len(text)

        page_images = extract_page_images(
            page=page,
            image_output_dir=image_dir,
            min_width=min_width,
            min_height=min_height,
            max_area_ratio=max_area_ratio,
            allow_large_images=allow_large_images,
        )
        total_images += len(page_images)

        md_lines.append(f"## Page {page_index + 1}")
        md_lines.append("")
        md_lines.append(f"`source: {pdf_path.name}#page={page_index + 1}`")
        md_lines.append("")
        if text:
            md_lines.append(text)
        else:
            md_lines.append("_No extractable text found on this page._")
        md_lines.append("")

        if page_images:
            md_lines.append("### Images")
            md_lines.append("")
            for img in page_images:
                rel_img = Path("..") / "images" / slug / img["file_name"]
                md_lines.append(f"![Page {page_index + 1} image]({rel_img.as_posix()})")
                md_lines.append(
                    f"- `image={img['file_name']}` `size={img['width']}x{img['height']}` `bbox_area_ratio={img['bbox_area_ratio']}`"
                )
                md_lines.append("")

        pages_meta.append(
            {
                "page": page_index + 1,
                "source_ref": f"{pdf_path.name}#page={page_index + 1}",
                "char_count": len(text),
                "image_count": len(page_images),
                "images": page_images,
            }
        )

    markdown_path.parent.mkdir(parents=True, exist_ok=True)
    markdown_path.write_text("\n".join(md_lines), encoding="utf-8")

    metadata = {
        "source_file": pdf_path.name,
        "source_path": str(pdf_path.resolve()),
        "slug": slug,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "relevance_rank": rank,
        "relevance_reason": reason,
        "page_count": doc.page_count,
        "total_text_chars": total_text_chars,
        "total_images_saved": total_images,
        "pages": pages_meta,
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    return DocSummary(
        file_name=pdf_path.name,
        markdown_path=markdown_path,
        metadata_path=metadata_path,
        pages=doc.page_count,
        text_chars=total_text_chars,
        images_saved=total_images,
        relevance_rank=rank,
        relevance_reason=reason,
    )


def write_index(
    index_path: Path,
    summaries: list[DocSummary],
    discovered_files: list[str],
    expected_file_names: set[str] | None,
) -> None:
    missing: list[str] = []
    if expected_file_names:
        discovered_normalized = {normalize_name(name) for name in discovered_files}
        missing = sorted(expected_file_names - discovered_normalized)

    sorted_docs = sorted(summaries, key=lambda s: (s.relevance_rank, s.file_name.lower()))
    lines = [
        "# Corpus Index",
        "",
        "This index prioritizes your FAA sources for question generation and links to extracted markdown.",
        "",
        "## Priority Order",
        "",
    ]
    for item in sorted_docs:
        lines.append(
            f"- `{item.relevance_rank}` `{item.file_name}` -> `{item.markdown_path.as_posix()}` "
            f"(pages={item.pages}, text_chars={item.text_chars}, images={item.images_saved})"
        )
        lines.append(f"  Reason: {item.relevance_reason}")

    if expected_file_names is not None:
        lines.extend(["", "## Missing Expected Files", ""])
        if missing:
            for m in missing:
                lines.append(f"- `{m}` (not found in current folder)")
        else:
            lines.append("- None")

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Convert OCR PDFs to markdown + image assets for LLM ingestion.")
    parser.add_argument("--input-dir", default=".", help="Directory containing PDF files.")
    parser.add_argument("--output-dir", default="out", help="Output root directory.")
    parser.add_argument("--pattern", default="*OCR.pdf", help="PDF filename glob pattern.")
    parser.add_argument("--min-image-width", type=int, default=160, help="Minimum image width to keep.")
    parser.add_argument("--min-image-height", type=int, default=120, help="Minimum image height to keep.")
    parser.add_argument(
        "--max-image-area-ratio",
        type=float,
        default=0.75,
        help="Skip images whose displayed area exceeds this fraction of page area.",
    )
    parser.add_argument(
        "--large-image-name-regex",
        default="akts|supplement",
        help="Keep full-page images for matching filenames (case-insensitive).",
    )
    parser.add_argument(
        "--keep-large-images",
        action="store_true",
        help="Keep large images for all documents, even if they exceed max image area ratio.",
    )
    parser.add_argument(
        "--expected-set",
        choices=["auto", "ocr", "none"],
        default="auto",
        help="Which expected-file set to report in index. 'auto' uses OCR set only for *OCR.pdf pattern.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir).resolve()
    output_dir = Path(args.output_dir).resolve()
    markdown_root = output_dir / "markdown"
    image_root = output_dir / "images"
    metadata_root = output_dir / "metadata"
    index_path = output_dir / "corpus_index.md"
    large_image_name_regex = (
        re.compile(args.large_image_name_regex, re.IGNORECASE) if args.large_image_name_regex else None
    )

    pdf_paths = sorted(input_dir.glob(args.pattern))
    if not pdf_paths:
        raise SystemExit(f"No files matched pattern '{args.pattern}' in {input_dir}")

    summaries: list[DocSummary] = []
    for pdf_path in pdf_paths:
        summary = convert_pdf(
            pdf_path=pdf_path,
            markdown_root=markdown_root,
            image_root=image_root,
            metadata_root=metadata_root,
            min_width=args.min_image_width,
            min_height=args.min_image_height,
            max_area_ratio=args.max_image_area_ratio,
            large_image_name_regex=large_image_name_regex,
            keep_large_images=args.keep_large_images,
        )
        summaries.append(summary)
        print(
            f"[ok] {summary.file_name}: pages={summary.pages}, text_chars={summary.text_chars}, "
            f"images_saved={summary.images_saved}, rank={summary.relevance_rank}"
        )

    expected: set[str] | None
    if args.expected_set == "none":
        expected = None
    elif args.expected_set == "ocr":
        expected = set(EXPECTED_PRIMARY_FILES.keys())
    else:
        expected = set(EXPECTED_PRIMARY_FILES.keys()) if "OCR" in args.pattern else None

    write_index(
        index_path=index_path,
        summaries=summaries,
        discovered_files=[p.name for p in pdf_paths],
        expected_file_names=expected,
    )
    print(f"[ok] index -> {index_path}")


if __name__ == "__main__":
    main()
