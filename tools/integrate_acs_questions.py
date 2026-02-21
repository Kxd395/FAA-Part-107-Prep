#!/usr/bin/env python3
"""
Integrate ACS mastery questions from a combined PDFtoMD bank
into this repo's app question-bank format.
"""

import argparse
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COMBINED_BANK = REPO_ROOT / "source-materials" / "PDFtoMD" / "out" / "question_bank_part107_combined.json"
DEFAULT_QUESTIONS_DIR = REPO_ROOT / "packages" / "content" / "questions"

# Category mapping from ACS area names to app categories
AREA_TO_CATEGORY = {
    "I. Regulations": "Regulations",
    "II. Airspace Classification and Operating Requirements": "Airspace",
    "III. Weather": "Weather",
    "IV. Loading and Performance": "Loading & Performance",
    "V. Operations": "Operations",
}

# Category to file mapping
CATEGORY_TO_FILE = {
    "Regulations": "regulations.json",
    "Airspace": "airspace.json",
    "Weather": "weather.json",
    "Loading & Performance": "loading_performance.json",
    "Operations": "operations.json",
}

# ID prefix per category
CATEGORY_TO_PREFIX = {
    "Regulations": "REG",
    "Airspace": "AIR",
    "Weather": "WX",
    "Loading & Performance": "LP",
    "Operations": "OPS",
}


def extract_subcategory(task_str: str | None) -> str:
    """Task A. General -> General"""
    if not task_str:
        return "General"
    match = re.match(r"Task\s+[A-Z]\.\s*(.*)", task_str)
    return match.group(1) if match else task_str


def estimate_difficulty(question: dict) -> int:
    """Simple heuristic for seeded ACS imports."""
    n_choices = len(question.get("choices", []))
    text_len = len(question.get("question", ""))
    if n_choices >= 4 and text_len > 150:
        return 3
    if n_choices >= 4 or text_len > 100:
        return 2
    return 1


def build_citation(question: dict) -> str | None:
    acs_code = question.get("acs_code")
    if acs_code:
        return f"ACS {acs_code}"
    return None


def build_tags(question: dict, category: str) -> list[str]:
    tags = ["acs-mastery", "part-107"]
    acs_code = question.get("acs_code", "")
    if acs_code:
        tags.append(acs_code.lower().replace(".", "-"))

    category_tags = {
        "Regulations": ["regulations", "14-cfr-107"],
        "Airspace": ["airspace", "operating-requirements"],
        "Weather": ["weather", "meteorology"],
        "Loading & Performance": ["loading", "performance", "weight-balance"],
        "Operations": ["operations", "procedures"],
    }
    tags.extend(category_tags.get(category, []))
    return sorted(set(tags))


def transform_acs_question(question: dict, category: str, seq_num: int) -> dict:
    prefix = CATEGORY_TO_PREFIX[category]
    choices = question.get("choices", [])

    options = [{"id": choice["label"], "text": choice["text"]} for choice in choices]

    correct_idx = question.get("correct_choice_index")
    if isinstance(correct_idx, int) and 0 <= correct_idx < len(choices):
        correct_option_id = choices[correct_idx]["label"]
    else:
        correct_option_id = "A"

    explanation = question.get("explanation", "")
    explanation_distractors = {
        choice["label"]: f"This is incorrect. {explanation}"
        for choice in choices
        if choice.get("label") != correct_option_id
    }

    return {
        "id": f"{prefix}-ACS-{seq_num:03d}",
        "category": category,
        "subcategory": extract_subcategory(question.get("task")),
        "question_text": question.get("question", ""),
        "figure_reference": None,
        "options": options,
        "correct_option_id": correct_option_id,
        "explanation_correct": explanation,
        "explanation_distractors": explanation_distractors,
        "citation": build_citation(question),
        "difficulty_level": estimate_difficulty(question),
        "tags": build_tags(question, category),
        "acs_code": question.get("acs_code"),
        "source": f"ACS Mastery ({question.get('acs_code', 'unknown')})",
        "source_type": "acs_generated",
    }


def load_combined_questions(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if isinstance(payload, dict) and isinstance(payload.get("questions"), list):
        return payload["questions"]
    if isinstance(payload, list):
        return payload

    raise ValueError("Combined bank must be a list or an object with questions[].")


def highest_sequence(questions: list[dict]) -> int:
    max_seq = 0
    for question in questions:
        match = re.search(r"(?:-ACS)?-(\d+)$", question.get("id", ""))
        if match:
            max_seq = max(max_seq, int(match.group(1)))
    return max_seq


def main() -> None:
    parser = argparse.ArgumentParser(description="Integrate ACS questions into local category files")
    parser.add_argument(
        "--combined-bank",
        default=str(DEFAULT_COMBINED_BANK),
        help="Path to combined question bank JSON",
    )
    parser.add_argument(
        "--questions-dir",
        default=str(DEFAULT_QUESTIONS_DIR),
        help="Path to packages/content/questions directory",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print plan without writing files")
    args = parser.parse_args()

    combined_bank = Path(args.combined_bank).expanduser().resolve()
    questions_dir = Path(args.questions_dir).expanduser().resolve()

    if not combined_bank.exists():
        raise SystemExit(f"Combined bank not found: {combined_bank}")
    if not questions_dir.exists():
        raise SystemExit(f"Questions directory not found: {questions_dir}")

    print(f"Loading combined bank from: {combined_bank}")
    all_questions = load_combined_questions(combined_bank)
    print(f"Total questions in bank: {len(all_questions)}")

    acs_questions = [q for q in all_questions if q.get("id", "").startswith("acs")]
    uag_questions = [q for q in all_questions if q.get("id", "").startswith("uag")]
    print(f"ACS questions: {len(acs_questions)}")
    print(f"UAG questions: {len(uag_questions)} (skipping - already curated in app bank)")

    existing_by_category: dict[str, list[dict]] = {}
    for category, filename in CATEGORY_TO_FILE.items():
        filepath = questions_dir / filename
        if filepath.exists():
            with filepath.open("r", encoding="utf-8") as handle:
                existing_by_category[category] = json.load(handle)
        else:
            existing_by_category[category] = []
        print(f"Existing {category}: {len(existing_by_category[category])} questions")

    existing_acs_codes = {
        question["acs_code"]
        for questions in existing_by_category.values()
        for question in questions
        if question.get("acs_code")
    }
    print(f"\nExisting ACS codes already in bank: {len(existing_acs_codes)}")

    acs_by_category: dict[str, list[dict]] = {}
    skipped = 0
    for question in acs_questions:
        area = question.get("area", "")
        category = AREA_TO_CATEGORY.get(area)
        if not category:
            print(f"  WARNING: Unknown area '{area}' for {question.get('id', '<missing-id>')}")
            skipped += 1
            continue

        acs_code = question.get("acs_code")
        if acs_code in existing_acs_codes:
            skipped += 1
            continue

        acs_by_category.setdefault(category, []).append(question)

    print(f"Skipped (duplicates or unknown area): {skipped}")

    new_counts: dict[str, int] = {}
    for category, filename in CATEGORY_TO_FILE.items():
        filepath = questions_dir / filename
        current = existing_by_category.get(category, [])
        max_seq = highest_sequence(current)

        transformed = [
            transform_acs_question(question, category, max_seq + i)
            for i, question in enumerate(acs_by_category.get(category, []), start=1)
        ]

        merged = current + transformed
        new_counts[category] = len(transformed)

        print(f"\n{category}:")
        print(f"  Existing: {len(current)}")
        print(f"  New ACS:  {len(transformed)}")
        print(f"  Total:    {len(merged)}")

        if not args.dry_run:
            with filepath.open("w", encoding="utf-8") as handle:
                json.dump(merged, handle, indent=2, ensure_ascii=False)

    total_existing = sum(len(existing_by_category.get(category, [])) for category in CATEGORY_TO_FILE)
    total_new = sum(new_counts.values())

    print(f"\n{'=' * 50}")
    print("INTEGRATION COMPLETE")
    print(f"{'=' * 50}")
    print(f"Previous total: {total_existing}")
    print(f"New ACS added:  {total_new}")
    print(f"Grand total:    {total_existing + total_new}")
    if args.dry_run:
        print("(dry-run: no files were written)")


if __name__ == "__main__":
    main()
