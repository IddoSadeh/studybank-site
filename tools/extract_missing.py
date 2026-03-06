"""
Re-extract incomplete years using Claude API
"""
import anthropic
import base64
import json
import os
import sys
from pathlib import Path
from pdf2image import convert_from_path

sys.stdout.reconfigure(encoding="utf-8")

# Set ANTHROPIC_API_KEY env var before running
if not os.environ.get('ANTHROPIC_API_KEY'):
    print("Error: ANTHROPIC_API_KEY not set"); sys.exit(1)

# Years that need re-extraction
YEARS_TO_EXTRACT = [2012, 2013, 2014, 2015, 2016, 2024, 2025]

EXTRACTION_PROMPT = """You are extracting physics exam questions from a CAP High School Prize Exam PDF page.

For each question visible on this page, extract:
1. Question number
2. Full question text (preserve all details, equations, values)
3. Answer choices (a, b, c, d, e, f if present)
4. Any diagrams description (describe what the diagram shows)

Return JSON array with this structure:
```json
[
  {
    "number": 1,
    "text": "Full question text here...",
    "choices": {
      "a": "Choice A text",
      "b": "Choice B text"
    },
    "has_diagram": true,
    "diagram_description": "Description of diagram if present"
  }
]
```

Rules:
- Extract ALL questions visible, even partial ones
- Preserve mathematical notation (use LaTeX: $v = v_0 + at$)
- Preserve Greek letters
- Skip headers, footers, instructions, constants tables
- Return empty array [] if no questions on this page

Return ONLY valid JSON, no other text."""


def pdf_to_images(pdf_path, dpi=150):
    try:
        images = convert_from_path(pdf_path, dpi=dpi)
        return images
    except Exception as e:
        print(f"Error converting PDF: {e}")
        return []


def image_to_base64(image):
    import io
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")


def extract_questions_from_page(client, image, page_num):
    base64_image = image_to_base64(image)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": base64_image}},
                    {"type": "text", "text": EXTRACTION_PROMPT}
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
        print(f"    Page {page_num}: Error - {e}")
        return []


def extract_year(client, year, pdf_dir, output_dir):
    exam_path = pdf_dir / f"{year}_exam.pdf"
    if not exam_path.exists():
        print(f"  {year}: PDF not found")
        return []

    print(f"  {year}: Converting PDF...", end=" ", flush=True)
    images = pdf_to_images(exam_path)
    if not images:
        print("Failed")
        return []
    print(f"{len(images)} pages")

    all_questions = []
    for i, image in enumerate(images):
        page_num = i + 1
        print(f"    Page {page_num}/{len(images)}...", end=" ", flush=True)
        questions = extract_questions_from_page(client, image, page_num)
        if questions:
            print(f"Found {len(questions)} questions")
            for q in questions:
                q["page"] = page_num
            all_questions.extend(questions)
        else:
            print("No questions")

    seen_numbers = set()
    final_questions = []
    for q in all_questions:
        q_num = q.get("number")
        if q_num is None:
            continue

        # Handle both integer and string question numbers (like "3A")
        q_num_str = str(q_num)
        if q_num_str in seen_numbers:
            continue
        seen_numbers.add(q_num_str)

        # Try to convert to int, otherwise keep as string
        try:
            q_num_int = int(q_num)
            q_id = f"{year}_Q{q_num_int:02d}"
        except (ValueError, TypeError):
            q_id = f"{year}_Q{q_num_str}"
            q_num_int = q_num_str

        final_q = {
            "id": q_id,
            "year": year,
            "number": q_num_int,
            "text": q.get("text", ""),
            "choices": q.get("choices", {}),
            "has_diagram": q.get("has_diagram", False),
            "diagram_description": q.get("diagram_description", ""),
            "page": q.get("page"),
            "correct_answer": None,
            "solution": None,
            "topics": [],
            "equations": [],
            "difficulty": None,
            "verified": False,
            "extraction_quality": "claude"
        }
        final_questions.append(final_q)

    def sort_key(x):
        num = x["number"]
        if isinstance(num, int):
            return (0, num, "")
        else:
            # Try to extract leading number
            import re
            match = re.match(r"(\d+)(.*)", str(num))
            if match:
                return (0, int(match.group(1)), match.group(2))
            return (1, 0, str(num))

    final_questions.sort(key=sort_key)

    raw_dir = output_dir / "raw"
    raw_dir.mkdir(exist_ok=True)
    with open(raw_dir / f"{year}_questions.json", "w", encoding="utf-8") as f:
        json.dump({"year": year, "questions": final_questions}, f, indent=2, ensure_ascii=False)

    print(f"  {year}: Extracted {len(final_questions)} questions")
    return final_questions


def main():
    client = anthropic.Anthropic()
    base_dir = Path(__file__).parent.parent
    pdf_dir = base_dir / "CAP_Exams"
    output_dir = base_dir / "data"

    print("Re-extracting incomplete years...")
    print("=" * 50)

    for year in YEARS_TO_EXTRACT:
        extract_year(client, year, pdf_dir, output_dir)

    print("=" * 50)
    print("Done!")


if __name__ == "__main__":
    main()
