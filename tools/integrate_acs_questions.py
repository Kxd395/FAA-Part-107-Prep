#!/usr/bin/env python3
"""
Integrate 352 ACS mastery questions from the separate PDFtoMD project
into our app's question bank format.

Merges with existing 51 questions (46 UAG + 5 SPA) that already have
verified answers and figure data.
"""

import json
import os
import re
from collections import Counter

# Paths
COMBINED_BANK = "/Volumes/Developer/test/PDFtoMD/out/question_bank_part107_combined.json"
QUESTIONS_DIR = "/Volumes/Developer/projects/experiments/FAA_107_Study_Guide/packages/content/questions"

# Category mapping from ACS area names to our app categories
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

# Task name extraction: "Task A. General" → "General"
def extract_subcategory(task_str):
    if not task_str:
        return "General"
    match = re.match(r'Task\s+[A-Z]\.\s*(.*)', task_str)
    return match.group(1) if match else task_str

# Difficulty heuristic based on number of choices and question complexity
def estimate_difficulty(q):
    n_choices = len(q.get("choices", []))
    text_len = len(q.get("question", ""))
    if n_choices >= 4 and text_len > 150:
        return 3  # hard
    elif n_choices >= 4 or text_len > 100:
        return 2  # medium
    return 1  # easy

# Build citation from ACS code and source_refs
def build_citation(q):
    parts = []
    acs = q.get("acs_code")
    if acs:
        parts.append(f"ACS {acs}")
    # Don't include local file paths from source_refs
    return "; ".join(parts) if parts else None

# Build tags from ACS code components
def build_tags(q, category):
    tags = ["acs-mastery", "part-107"]
    acs = q.get("acs_code", "")
    if acs:
        tags.append(acs.lower().replace(".", "-"))
    # Add category-specific tags
    cat_tags = {
        "Regulations": ["regulations", "14-cfr-107"],
        "Airspace": ["airspace", "operating-requirements"],
        "Weather": ["weather", "meteorology"],
        "Loading & Performance": ["loading", "performance", "weight-balance"],
        "Operations": ["operations", "procedures"],
    }
    tags.extend(cat_tags.get(category, []))
    return list(set(tags))  # deduplicate


def transform_acs_question(q, category, seq_num):
    """Transform an ACS question to our app format."""
    prefix = CATEGORY_TO_PREFIX[category]
    
    # Convert choices to our option format
    options = []
    for choice in q.get("choices", []):
        options.append({
            "id": choice["label"],
            "text": choice["text"]
        })
    
    # Determine correct answer
    correct_idx = q.get("correct_choice_index")
    choices = q.get("choices", [])
    if correct_idx is not None and correct_idx < len(choices):
        correct_option_id = choices[correct_idx]["label"]
    else:
        correct_option_id = "A"  # fallback
    
    # Build distractor explanations
    explanation_distractors = {}
    for choice in choices:
        if choice["label"] != correct_option_id:
            explanation_distractors[choice["label"]] = f"This is incorrect. {q.get('explanation', '')}"
    
    return {
        "id": f"{prefix}-ACS-{seq_num:03d}",
        "category": category,
        "subcategory": extract_subcategory(q.get("task")),
        "question_text": q.get("question", ""),
        "figure_reference": None,
        "options": options,
        "correct_option_id": correct_option_id,
        "explanation_correct": q.get("explanation", ""),
        "explanation_distractors": explanation_distractors,
        "citation": build_citation(q),
        "difficulty_level": estimate_difficulty(q),
        "tags": build_tags(q, category),
        "acs_code": q.get("acs_code"),
        "source": f"ACS Mastery ({q.get('acs_code', 'unknown')})",
        "source_type": "acs_generated"
    }


def main():
    # Load the combined bank
    print(f"Loading combined bank from: {COMBINED_BANK}")
    with open(COMBINED_BANK, 'r') as f:
        bank = json.load(f)
    
    all_questions = bank["questions"]
    print(f"Total questions in bank: {len(all_questions)}")
    
    # Separate ACS vs UAG
    acs_questions = [q for q in all_questions if q.get("id", "").startswith("acs")]
    uag_questions = [q for q in all_questions if q.get("id", "").startswith("uag")]
    print(f"ACS questions: {len(acs_questions)}")
    print(f"UAG questions: {len(uag_questions)} (skipping - we already have these with verified answers)")
    
    # Load existing questions per category
    existing = {}
    for category, filename in CATEGORY_TO_FILE.items():
        filepath = os.path.join(QUESTIONS_DIR, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r') as f:
                existing[category] = json.load(f)
            print(f"Existing {category}: {len(existing[category])} questions")
        else:
            existing[category] = []
            print(f"Existing {category}: 0 questions (file not found)")
    
    # Track existing ACS codes to avoid duplicates
    existing_acs_codes = set()
    for cat_qs in existing.values():
        for q in cat_qs:
            if q.get("acs_code"):
                existing_acs_codes.add(q["acs_code"])
    print(f"\nExisting ACS codes already in bank: {len(existing_acs_codes)}")
    
    # Group ACS questions by category
    acs_by_category = {}
    skipped = 0
    for q in acs_questions:
        area = q.get("area", "")
        category = AREA_TO_CATEGORY.get(area)
        if not category:
            print(f"  WARNING: Unknown area '{area}' for {q['id']}")
            skipped += 1
            continue
        
        # Skip if ACS code already exists in our bank
        if q.get("acs_code") in existing_acs_codes:
            skipped += 1
            continue
        
        if category not in acs_by_category:
            acs_by_category[category] = []
        acs_by_category[category].append(q)
    
    print(f"Skipped (duplicates or unknown area): {skipped}")
    
    # Transform and merge
    new_counts = {}
    for category, filename in CATEGORY_TO_FILE.items():
        filepath = os.path.join(QUESTIONS_DIR, filename)
        current = existing.get(category, [])
        
        # Find the highest existing sequence number
        max_seq = 0
        for q in current:
            match = re.search(r'-(\d+)$', q.get("id", ""))
            if match:
                max_seq = max(max_seq, int(match.group(1)))
        
        # Also check for ACS-NNN pattern
        for q in current:
            match = re.search(r'ACS-(\d+)$', q.get("id", ""))
            if match:
                max_seq = max(max_seq, int(match.group(1)))
        
        # Transform new ACS questions
        acs_for_cat = acs_by_category.get(category, [])
        new_questions = []
        for i, q in enumerate(acs_for_cat, start=1):
            transformed = transform_acs_question(q, category, max_seq + i)
            new_questions.append(transformed)
        
        # Merge: existing first, then new ACS
        merged = current + new_questions
        new_counts[category] = len(new_questions)
        
        # Write back
        with open(filepath, 'w') as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)
        
        print(f"\n{category}:")
        print(f"  Existing: {len(current)}")
        print(f"  New ACS:  {len(new_questions)}")
        print(f"  Total:    {len(merged)}")
    
    # Summary
    total_existing = sum(len(existing.get(c, [])) for c in CATEGORY_TO_FILE.keys())
    total_new = sum(new_counts.values())
    total = total_existing + total_new
    print(f"\n{'='*50}")
    print(f"INTEGRATION COMPLETE")
    print(f"{'='*50}")
    print(f"Previous total: {total_existing}")
    print(f"New ACS added:  {total_new}")
    print(f"Grand total:    {total}")
    print(f"\nBreakdown:")
    for category, filename in CATEGORY_TO_FILE.items():
        filepath = os.path.join(QUESTIONS_DIR, filename)
        with open(filepath, 'r') as f:
            count = len(json.load(f))
        print(f"  {category}: {count}")


if __name__ == "__main__":
    main()
