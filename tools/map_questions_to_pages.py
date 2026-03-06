"""
Map questions to pages without cropping.
Just identifies which questions appear on each page.
"""
import anthropic
import base64
import json
import os
import sys
from pathlib import Path
from PIL import Image
import io

sys.stdout.reconfigure(encoding="utf-8")

# Set ANTHROPIC_API_KEY env var before running
if not os.environ.get('ANTHROPIC_API_KEY'):
    print("Error: ANTHROPIC_API_KEY not set"); sys.exit(1)

BASE_DIR = Path(__file__).parent.parent
IMAGES_DIR = BASE_DIR / "images"
DATA_DIR = BASE_DIR / "data"

PAGE_PROMPT = """Analyze this physics exam page.

List ALL multiple-choice question numbers visible on this page.
Multiple-choice questions have lettered answer choices (a, b, c, d, e).

Ignore:
- "Part B" free-response questions
- Answer keys
- Constants tables (unless they contain questions)

Return JSON:
```json
{
  "question_numbers": [1, 2, 3, 4, 5],
  "is_answer_key": false,
  "has_part_b": false,
  "notes": "Questions 1-5 on left and right columns"
}
```

Return ONLY valid JSON, no other text."""


def load_page_image(year, page):
    """Load page image as base64"""
    img_path = IMAGES_DIR / str(year) / f"page_{page}.png"
    if not img_path.exists():
        return None
    with open(img_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def analyze_page(client, year, page):
    """Get question numbers from a page"""
    img_b64 = load_page_image(year, page)
    if not img_b64:
        return None

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": img_b64
                        }
                    },
                    {"type": "text", "text": PAGE_PROMPT}
                ]
            }]
        )

        content = response.content[0].text
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        return json.loads(content.strip())

    except Exception as e:
        print(f"Error: {e}")
        return None


def get_page_count(year):
    """Count page images for a year"""
    year_dir = IMAGES_DIR / str(year)
    if not year_dir.exists():
        return 0
    return len(list(year_dir.glob("page_*.png")))


def process_year(client, year, q_lookup):
    """Process all pages for a year"""
    page_count = get_page_count(year)
    if page_count == 0:
        return {}

    print(f"\n{year}: {page_count} pages")

    page_mapping = {}  # question_number -> page

    for page in range(1, page_count + 1):
        print(f"  Page {page}...", end=" ", flush=True)

        result = analyze_page(client, year, page)

        if not result:
            print("FAILED")
            continue

        q_nums = result.get("question_numbers", [])
        is_answer_key = result.get("is_answer_key", False)

        if is_answer_key:
            print("(answer key, skipped)")
            continue

        if q_nums:
            print(f"Q{q_nums}")

            for q_num in q_nums:
                # Only set page if not already set (first occurrence wins)
                if q_num not in page_mapping:
                    page_mapping[q_num] = page

                    # Update question in lookup
                    key = (year, q_num)
                    if key in q_lookup:
                        q_lookup[key]["page"] = page
        else:
            print("no questions")

    return page_mapping


def main():
    # Load questions
    questions_file = DATA_DIR / "questions.json"
    with open(questions_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    q_lookup = {(q["year"], q["number"]): q for q in data["questions"]}

    # Get years to process
    if len(sys.argv) > 1:
        try:
            years = [int(sys.argv[1])]
        except ValueError:
            years = sorted(set(q["year"] for q in data["questions"]))
    else:
        years = sorted(set(q["year"] for q in data["questions"]))

    print(f"Question-to-Page Mapping")
    print(f"Years: {years}")
    print("=" * 60)

    client = anthropic.Anthropic()

    all_mappings = {}

    for year in years:
        mapping = process_year(client, year, q_lookup)
        all_mappings[year] = mapping

    # Save updated questions
    with open(questions_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # Save page mapping separately
    with open(DATA_DIR / "page_mapping.json", "w", encoding="utf-8") as f:
        json.dump(all_mappings, f, indent=2)

    print("\n" + "=" * 60)
    print(f"Complete!")
    print(f"  Questions updated: {questions_file}")
    print(f"  Page mapping saved: {DATA_DIR / 'page_mapping.json'}")


if __name__ == "__main__":
    main()
