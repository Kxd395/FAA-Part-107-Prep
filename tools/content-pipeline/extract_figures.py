"""
Part 107 Exam Prep — Figure Extractor
Extracts high-resolution figures from the FAA Testing Supplement PDF.

Usage:
    python extract_figures.py --pdf ../../sport_rec_private_akts.pdf
    python extract_figures.py --pdf ../../sport_rec_private_akts.pdf --dpi 300

Requirements:
    pip install pymupdf Pillow
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌ PyMuPDF not installed. Run: pip install pymupdf")
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent.parent.parent / "packages" / "content" / "figures"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"


def extract_all_images(pdf_path: str, dpi: int = 300):
    """Extract all images from the PDF at the specified DPI."""
    doc = fitz.open(pdf_path)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    extracted = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        images = page.get_images(full=True)

        for img_index, img in enumerate(images):
            xref = img[0]
            base_image = doc.extract_image(xref)
            image_bytes = base_image["image"]
            image_ext = base_image["ext"]

            filename = f"page_{page_num + 1:03d}_img_{img_index + 1:02d}.{image_ext}"
            filepath = OUTPUT_DIR / filename

            with open(filepath, "wb") as f:
                f.write(image_bytes)

            extracted.append({
                "page": page_num + 1,
                "index": img_index + 1,
                "file": filename,
                "size_bytes": len(image_bytes),
                "format": image_ext,
            })
            print(f"  📸 Page {page_num + 1}, Image {img_index + 1} → {filename}")

    doc.close()
    return extracted


def render_pages_as_images(pdf_path: str, dpi: int = 300, pages: list[int] = None):
    """Render specific PDF pages as high-res PNGs (better for charts/maps)."""
    doc = fitz.open(pdf_path)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    zoom = dpi / 72  # 72 DPI is the default PDF resolution
    matrix = fitz.Matrix(zoom, zoom)

    rendered = []
    page_list = pages if pages else range(len(doc))

    for page_num in page_list:
        if page_num < 0 or page_num >= len(doc):
            continue
        page = doc[page_num]
        pix = page.get_pixmap(matrix=matrix)

        filename = f"page_{page_num + 1:03d}.png"
        filepath = OUTPUT_DIR / filename
        pix.save(str(filepath))

        rendered.append({
            "page": page_num + 1,
            "file": filename,
            "width": pix.width,
            "height": pix.height,
            "dpi": dpi,
        })
        print(f"  🗺️  Page {page_num + 1} → {filename} ({pix.width}x{pix.height}px)")

    doc.close()
    return rendered


def main():
    parser = argparse.ArgumentParser(description="Extract figures from FAA Testing Supplement PDF")
    parser.add_argument("--pdf", required=True, help="Path to the Testing Supplement PDF")
    parser.add_argument("--dpi", type=int, default=300, help="Resolution for rendered pages (default: 300)")
    parser.add_argument("--pages", help="Specific pages to render (e.g., '20,21,22,26,59,69,78')")
    parser.add_argument("--mode", choices=["images", "render", "both"], default="render",
                        help="Extract embedded images, render pages, or both")
    args = parser.parse_args()

    print(f"\n🗺️  Part 107 Figure Extractor")
    print(f"{'─' * 40}")
    print(f"  PDF: {args.pdf}")
    print(f"  DPI: {args.dpi}")
    print(f"  Mode: {args.mode}")
    print(f"  Output: {OUTPUT_DIR}")

    results = {"embedded_images": [], "rendered_pages": []}

    if args.mode in ("images", "both"):
        print(f"\n📸 Extracting embedded images...")
        results["embedded_images"] = extract_all_images(args.pdf, args.dpi)
        print(f"  Found {len(results['embedded_images'])} images")

    if args.mode in ("render", "both"):
        pages = None
        if args.pages:
            pages = [int(p.strip()) - 1 for p in args.pages.split(",")]  # Convert to 0-indexed
        print(f"\n🖼️  Rendering pages as high-res PNGs...")
        results["rendered_pages"] = render_pages_as_images(args.pdf, args.dpi, pages)
        print(f"  Rendered {len(results['rendered_pages'])} pages")

    # Save extraction log
    log_path = OUTPUT_DIR / "extraction_log.json"
    with open(log_path, "w") as f:
        json.dump(results, f, indent=2)

    total = len(results["embedded_images"]) + len(results["rendered_pages"])
    print(f"\n✅ Done! Extracted {total} files to {OUTPUT_DIR}\n")


if __name__ == "__main__":
    main()
