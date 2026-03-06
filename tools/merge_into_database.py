"""
Merge free-response questions into the main questions.json database.
Also adds question_type and section fields to existing MC questions.
Then copies the result to web/data/questions.json for the web interface.
"""
import json
import shutil
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
SITE_DATA_DIR = BASE_DIR / "web" / "data"


def main():
    # Load existing MC questions
    mc_file = DATA_DIR / "questions.json"
    with open(mc_file, "r", encoding="utf-8") as f:
        mc_data = json.load(f)

    mc_questions = mc_data["questions"]
    print(f"Loaded {len(mc_questions)} existing MC questions")

    # Tag MC questions with type/section if not already tagged
    mc_updated = 0
    for q in mc_questions:
        if "question_type" not in q:
            q["question_type"] = "multiple_choice"
            q["section"] = "A"
            mc_updated += 1
    print(f"  Tagged {mc_updated} MC questions with question_type/section")

    # Load free-response questions
    fr_file = DATA_DIR / "free_response_questions.json"
    if not fr_file.exists():
        print("Warning: free_response_questions.json not found. Only updating MC metadata.")
        fr_questions = []
    else:
        with open(fr_file, "r", encoding="utf-8") as f:
            fr_data = json.load(f)
        fr_questions = fr_data["questions"]
        print(f"Loaded {len(fr_questions)} free-response questions")

    # Check for duplicates (by ID)
    existing_ids = {q["id"] for q in mc_questions}
    new_fr = [q for q in fr_questions if q["id"] not in existing_ids]
    skipped = len(fr_questions) - len(new_fr)
    if skipped:
        print(f"  Skipped {skipped} duplicate FR questions (already in database)")

    # Merge
    all_questions = mc_questions + new_fr
    def sort_key(q):
        num = q["number"]
        try:
            num = int(num)
        except (ValueError, TypeError):
            # Handle alphanumeric like "3A" — extract leading digits
            import re
            m = re.match(r'(\d+)', str(num))
            num = int(m.group(1)) if m else 0
        return (q["year"], q.get("section", "A"), num)

    all_questions.sort(key=sort_key)

    # Build combined database
    all_years = sorted(set(q["year"] for q in all_questions))
    combined = {
        "total_questions": len(all_questions),
        "years": all_years,
        "questions": all_questions
    }

    # Save updated main database
    with open(mc_file, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
    print(f"\nSaved {len(all_questions)} total questions to {mc_file}")

    # Copy to site
    SITE_DATA_DIR.mkdir(parents=True, exist_ok=True)
    site_file = SITE_DATA_DIR / "questions.json"
    shutil.copy2(mc_file, site_file)
    print(f"Copied to {site_file}")

    # Summary
    mc_count = sum(1 for q in all_questions if q.get("question_type") == "multiple_choice")
    fr_count = sum(1 for q in all_questions if q.get("question_type") == "free_response")
    fr_processed = sum(1 for q in all_questions if q.get("question_type") == "free_response" and q.get("ai_processed"))

    print(f"\n{'='*40}")
    print(f"Database summary:")
    print(f"  Multiple choice: {mc_count}")
    print(f"  Free response:   {fr_count} ({fr_processed} enriched)")
    print(f"  Total:           {len(all_questions)}")
    print(f"  Years:           {all_years[0]}-{all_years[-1]} ({len(all_years)} years)")


if __name__ == "__main__":
    main()
