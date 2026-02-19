"""
Part 107 Exam Prep — Content Pipeline
Extracts text from FAA PDFs and generates structured question JSON using AI.

Usage:
    python generate_questions.py --pdf ../../remote_pilot_study_guide.pdf --topic "Regulations" --count 10
    python generate_questions.py --pdf ../../remote_pilot_study_guide.pdf --topic "Airspace" --pages 30-50 --count 15

Requirements:
    pip install pymupdf anthropic python-dotenv
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError:
    print("❌ PyMuPDF not installed. Run: pip install pymupdf")
    sys.exit(1)

try:
    import anthropic
except ImportError:
    print("❌ Anthropic SDK not installed. Run: pip install anthropic")
    sys.exit(1)

from dotenv import load_dotenv

load_dotenv()

# -----------------------------------------------------------
# Configuration
# -----------------------------------------------------------
SCHEMA_PATH = Path(__file__).parent.parent.parent / "packages" / "content" / "schema" / "question.schema.json"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "packages" / "content" / "questions"

CATEGORY_PREFIXES = {
    "Regulations": "REG",
    "Airspace": "AIR",
    "Weather": "WX",
    "Loading & Performance": "LOAD",
    "Operations": "OPS",
    "Emergency Procedures": "EMER",
    "Crew Resource Management": "CRM",
    "Radio Communications": "RADIO",
    "Airport Operations": "APT",
    "Maintenance & Preflight": "MNT",
    "Physiology": "PHYS",
    "Remote ID": "RID",
}


def extract_pdf_text(pdf_path: str, start_page: int = None, end_page: int = None) -> str:
    """Extract text from a PDF file, optionally limiting to a page range."""
    doc = fitz.open(pdf_path)
    text_parts = []

    start = (start_page - 1) if start_page else 0
    end = end_page if end_page else len(doc)

    for page_num in range(start, min(end, len(doc))):
        page = doc[page_num]
        text_parts.append(f"\n--- Page {page_num + 1} ---\n")
        text_parts.append(page.get_text())

    doc.close()
    return "".join(text_parts)


def get_existing_ids(topic: str) -> set:
    """Get existing question IDs for a topic to avoid duplicates."""
    prefix = CATEGORY_PREFIXES.get(topic, "UNK")
    output_file = OUTPUT_DIR / f"{topic.lower().replace(' & ', '_').replace(' ', '_')}.json"

    if not output_file.exists():
        return set()

    with open(output_file, "r") as f:
        existing = json.load(f)

    return {q["id"] for q in existing}


def get_next_id(topic: str, existing_ids: set) -> int:
    """Get the next available question number for a topic."""
    prefix = CATEGORY_PREFIXES.get(topic, "UNK")
    existing_nums = []
    for qid in existing_ids:
        if qid.startswith(prefix):
            try:
                num = int(qid.split("-")[1])
                existing_nums.append(num)
            except (IndexError, ValueError):
                pass
    return max(existing_nums, default=0) + 1


def generate_questions(
    pdf_text: str,
    topic: str,
    count: int,
    start_num: int,
) -> list[dict]:
    """Use Claude to generate structured questions from PDF text."""

    prefix = CATEGORY_PREFIXES.get(topic, "UNK")
    id_range = f"{prefix}-{start_num:03d} through {prefix}-{start_num + count - 1:03d}"

    # Load schema for reference
    with open(SCHEMA_PATH, "r") as f:
        schema = json.load(f)

    prompt = f"""You are an FAA Part 107 exam question writer. Your job is to create realistic, 
high-quality multiple-choice questions based on the provided study material.

TOPIC: {topic}
GENERATE: {count} questions
ID RANGE: {id_range}

RULES:
1. Each question MUST have exactly 3 options (A, B, C) — this matches the real FAA exam format.
2. Each question MUST have a detailed explanation for the correct answer.
3. Each question MUST have "distractor explanations" — explain why each WRONG answer is wrong.
4. Questions should vary in difficulty (1=easy recall, 2=application, 3=scenario-based).
5. Include the specific CFR citation or study guide reference.
6. Make wrong answers plausible — they should be common misconceptions.
7. DO NOT copy questions verbatim from the FAA question bank. Rephrase and create original questions.
8. Include subcategory for each question.
9. Include relevant tags for filtering.
10. Set year_updated to 2026.

OUTPUT FORMAT: Return ONLY a valid JSON array. No markdown, no code blocks, just the raw JSON.

Each object in the array must follow this exact structure:
{{
  "id": "{prefix}-NNN",
  "category": "{topic}",
  "subcategory": "specific sub-topic",
  "question_text": "the question",
  "figure_reference": null,
  "options": [
    {{ "id": "A", "text": "option text" }},
    {{ "id": "B", "text": "option text" }},
    {{ "id": "C", "text": "option text" }}
  ],
  "correct_option_id": "A",
  "explanation_correct": "Why this is right...",
  "explanation_distractors": {{
    "B": "Why B is wrong...",
    "C": "Why C is wrong..."
  }},
  "citation": "14 CFR 107.XX",
  "difficulty_level": 1,
  "acs_code": "UA.X.X",
  "tags": ["tag1", "tag2"],
  "year_updated": 2026
}}

SOURCE MATERIAL:
{pdf_text[:15000]}
"""

    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[{"role": "user", "content": prompt}],
    )

    # Parse the response
    response_text = response.content[0].text.strip()

    # Handle potential markdown code blocks
    if response_text.startswith("```"):
        response_text = response_text.split("\n", 1)[1]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

    questions = json.loads(response_text)
    return questions


def save_questions(questions: list[dict], topic: str, merge: bool = True):
    """Save generated questions to the appropriate JSON file."""
    filename = topic.lower().replace(" & ", "_").replace(" ", "_") + ".json"
    output_file = OUTPUT_DIR / filename

    if merge and output_file.exists():
        with open(output_file, "r") as f:
            existing = json.load(f)
        existing_ids = {q["id"] for q in existing}
        new_questions = [q for q in questions if q["id"] not in existing_ids]
        all_questions = existing + new_questions
        print(f"  Merged {len(new_questions)} new questions with {len(existing)} existing")
    else:
        all_questions = questions

    # Sort by ID
    all_questions.sort(key=lambda q: q["id"])

    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(all_questions, f, indent=2, ensure_ascii=False)

    print(f"  ✅ Saved {len(all_questions)} total questions to {output_file}")


def validate_questions(questions: list[dict]) -> list[str]:
    """Basic validation of generated questions."""
    errors = []
    for q in questions:
        if len(q.get("options", [])) != 3:
            errors.append(f"{q['id']}: Must have exactly 3 options")
        if q.get("correct_option_id") not in ("A", "B", "C"):
            errors.append(f"{q['id']}: Invalid correct_option_id")
        if not q.get("explanation_correct"):
            errors.append(f"{q['id']}: Missing explanation_correct")
        if not q.get("explanation_distractors"):
            errors.append(f"{q['id']}: Missing explanation_distractors")
        if not q.get("citation"):
            errors.append(f"{q['id']}: Missing citation")
    return errors


def main():
    parser = argparse.ArgumentParser(description="Generate Part 107 exam questions from FAA PDFs")
    parser.add_argument("--pdf", required=True, help="Path to the source PDF")
    parser.add_argument("--topic", required=True, choices=list(CATEGORY_PREFIXES.keys()),
                        help="Question topic/category")
    parser.add_argument("--count", type=int, default=5, help="Number of questions to generate")
    parser.add_argument("--pages", help="Page range (e.g., '10-20')")
    parser.add_argument("--no-merge", action="store_true", help="Overwrite instead of merging")
    parser.add_argument("--dry-run", action="store_true", help="Extract text only, don't call AI")
    args = parser.parse_args()

    print(f"\n🛩️  Part 107 Question Generator")
    print(f"{'─' * 40}")
    print(f"  PDF: {args.pdf}")
    print(f"  Topic: {args.topic}")
    print(f"  Count: {args.count}")

    # Parse page range
    start_page = end_page = None
    if args.pages:
        parts = args.pages.split("-")
        start_page = int(parts[0])
        end_page = int(parts[1]) if len(parts) > 1 else start_page
        print(f"  Pages: {start_page}-{end_page}")

    # Extract PDF text
    print(f"\n📄 Extracting text from PDF...")
    pdf_text = extract_pdf_text(args.pdf, start_page, end_page)
    print(f"  Extracted {len(pdf_text):,} characters")

    if args.dry_run:
        print(f"\n📝 Extracted text preview (first 500 chars):")
        print(pdf_text[:500])
        return

    # Check for API key
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("\n❌ ANTHROPIC_API_KEY not set. Add it to .env or export it.")
        sys.exit(1)

    # Get existing questions
    existing_ids = get_existing_ids(args.topic)
    start_num = get_next_id(args.topic, existing_ids)
    print(f"\n🔢 Starting at ID: {CATEGORY_PREFIXES[args.topic]}-{start_num:03d}")

    # Generate questions
    print(f"\n🤖 Generating {args.count} questions with Claude...")
    questions = generate_questions(pdf_text, args.topic, args.count, start_num)
    print(f"  Generated {len(questions)} questions")

    # Validate
    errors = validate_questions(questions)
    if errors:
        print(f"\n⚠️  Validation warnings:")
        for err in errors:
            print(f"    - {err}")

    # Save
    print(f"\n💾 Saving questions...")
    save_questions(questions, args.topic, merge=not args.no_merge)

    print(f"\n✅ Done! Generated {len(questions)} {args.topic} questions.\n")


if __name__ == "__main__":
    main()
