"""
Fix 1997 Q6-Q25: restore raw text, fix page mappings, reset ai_processed.
Then run: python tools/ai_pipeline.py
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

BASE = Path(__file__).parent.parent
DB = BASE / "data" / "questions.json"
RAW = BASE / "data" / "raw" / "1997_questions.json"

# Page mapping from visual inspection of page images
# Page 1: Q1-Q5, Page 2: Q6-Q14, Page 3: Q15-Q23, Page 4: Q23(choices)+Q24-Q25
PAGE_MAP = {}
for n in range(1, 6):
    PAGE_MAP[n] = 1
for n in range(6, 15):
    PAGE_MAP[n] = 2
for n in range(15, 24):
    PAGE_MAP[n] = 3
for n in range(24, 26):
    PAGE_MAP[n] = 4
# Q23 spans pages 3-4 but main text is on page 3

# Load raw questions
with open(RAW, "r", encoding="utf-8") as f:
    raw_data = json.load(f)

raw_by_num = {}
for q in raw_data["questions"]:
    raw_by_num[q["number"]] = q

# Load database
with open(DB, "r", encoding="utf-8") as f:
    db = json.load(f)

fixed = 0
for q in db["questions"]:
    if q["year"] != 1997:
        continue
    num = q["number"]
    if num < 6:
        continue

    raw = raw_by_num.get(num)
    if not raw:
        print(f"  Warning: no raw data for Q{num}")
        continue

    # Restore original text and choices from raw extraction
    q["text"] = raw["text"]
    q["choices"] = raw["choices"]

    # Fix page mapping
    q["page"] = PAGE_MAP.get(num, 1)

    # Reset processing flag so ai_pipeline picks it up
    q["ai_processed"] = False
    q["verified"] = False

    fixed += 1
    print(f"  Fixed {q['id']}: page={q['page']}, text='{q['text'][:60]}...'")

# Save
with open(DB, "w", encoding="utf-8") as f:
    json.dump(db, f, indent=2, ensure_ascii=False)

# Also update site copy
site_db = BASE / "web" / "data" / "questions.json"
with open(site_db, "w", encoding="utf-8") as f:
    json.dump(db, f, indent=2, ensure_ascii=False)

print(f"\nDone. Fixed {fixed} questions. Now run: python tools/ai_pipeline.py")
