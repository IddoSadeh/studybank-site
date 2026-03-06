"""
Extract Section B (free-response) questions from CAP exam PDFs using Claude API with vision.
These are the 3 long-answer problems at the end of each exam, after the 25 MC questions.
"""
import anthropic
import base64
import json
import os
import sys
from pathlib import Path
from pdf2image import convert_from_path

sys.stdout.reconfigure(encoding='utf-8')

ALL_YEARS = list(range(1994, 2020)) + [2022, 2023, 2024, 2025]

EXTRACTION_PROMPT = """You are extracting FREE-RESPONSE (long-answer) questions from the Section B / Part B
of a CAP High School Prize Exam PDF.

These are NOT multiple-choice. They are multi-part written problems that require full worked solutions.
Each exam has exactly 3 free-response questions (numbered 1, 2, 3 within Section B).

I am sending you ALL pages of Section B at once. Extract every free-response question you see.

For each question, extract:
1. Question number (1, 2, or 3 — the Section B numbering)
2. Full problem statement (the main text/scenario/setup)
3. Sub-parts: each labeled part like (a), (b), (c), (d) OR numbered 1., 2., 3. within the question
4. Any given data, equations, or hints provided with the question
5. Diagram descriptions if present

Return JSON array:
```json
[
  {
    "number": 1,
    "text": "Full problem statement / setup text here. Include all context, given values, and scenario description.",
    "parts": [
      {
        "label": "a",
        "text": "What this sub-part asks..."
      },
      {
        "label": "b",
        "text": "What this sub-part asks..."
      }
    ],
    "given_data": "Any provided constants, equations, or hints specific to this problem (not the general data sheet)",
    "has_diagram": true,
    "diagram_description": "Description of any diagram/figure"
  }
]
```

Rules:
- Extract ALL 3 free-response questions (or however many are on these pages)
- If a question has NO labeled sub-parts (it's one open-ended problem), use "parts": []
- Preserve ALL mathematical notation using LaTeX ($v = v_0 + at$, $\\frac{1}{2}mv^2$)
- Preserve Greek letters (α, β, θ, φ, etc.)
- Include the COMPLETE text — these are long problems, don't truncate
- The "text" field should contain the main problem setup/scenario
- Each sub-part's text should contain only what that specific part asks
- If a question spans multiple pages, combine all content into one entry
- Skip the general data/constants table, instructions, and headers
- "given_data" is for problem-specific data (e.g., "The solar constant S = 1370 W/m²")

Return ONLY valid JSON, no other text."""


def pdf_to_images(pdf_path, dpi=150):
    """Convert PDF pages to images"""
    try:
        images = convert_from_path(pdf_path, dpi=dpi)
        return images
    except Exception as e:
        print(f"Error converting PDF: {e}")
        return []


def image_to_base64(image):
    """Convert PIL image to base64"""
    import io
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    return base64.standard_b64encode(buffer.getvalue()).decode('utf-8')


def find_section_b_pages(images, client):
    """Find which pages contain Section B by checking the last few pages.
    Section B typically starts after the MC questions end (usually page 5-8 onwards).
    We send all pages from the midpoint onward to be safe."""
    # For most exams: pages 1-2 are cover/info, 3-7 are MC, 8-10 are FR
    # Just return the back half of the exam to be safe
    total = len(images)
    if total <= 3:
        return list(range(total))  # Small PDF, send all

    # Start from roughly halfway (MC is ~25 questions on ~4-5 pages)
    # Section B usually starts around page 5-8
    start = max(total // 2 - 1, 2)  # At least page 3
    return list(range(start, total))


def extract_free_response(client, year, pdf_dir, output_dir):
    """Extract free-response questions from one year's exam"""
    # Try exam PDF first, some years have combined exam+solutions
    exam_path = pdf_dir / f"{year}_exam.pdf"

    if not exam_path.exists():
        print(f"  {year}: PDF not found")
        return []

    print(f"  {year}: Converting PDF...", end=" ", flush=True)
    images = pdf_to_images(exam_path)

    if not images:
        print("Failed")
        return []

    print(f"{len(images)} pages total")

    # Find Section B pages
    section_b_indices = find_section_b_pages(images, client)
    section_b_images = [images[i] for i in section_b_indices]
    page_nums = [i + 1 for i in section_b_indices]

    print(f"    Sending pages {page_nums} for Section B extraction...")

    # Send all Section B pages at once for better context
    content_blocks = []
    for img in section_b_images:
        b64 = image_to_base64(img)
        content_blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": b64
            }
        })

    content_blocks.append({
        "type": "text",
        "text": EXTRACTION_PROMPT
    })

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            messages=[{
                "role": "user",
                "content": content_blocks
            }]
        )

        content = response.content[0].text

        # Extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        questions = json.loads(content.strip())

        if not questions:
            print(f"  {year}: No free-response questions found")
            return []

        # Build final question objects
        final_questions = []
        for q in questions:
            q_num = q.get("number")
            if not q_num:
                continue

            final_q = {
                "id": f"{year}_FR{q_num}",
                "year": year,
                "number": q_num,
                "question_type": "free_response",
                "section": "B",
                "text": q.get("text", ""),
                "parts": q.get("parts", []),
                "given_data": q.get("given_data", ""),
                "choices": {},
                "has_diagram": q.get("has_diagram", False),
                "diagram_description": q.get("diagram_description", ""),
                "correct_answer": None,
                "solution": None,
                "topics": [],
                "equations": [],
                "difficulty": None,
                "verified": False,
                "extraction_quality": "claude",
                "ai_processed": False,
                "source": "cap",
                "subject": "physics"
            }
            final_questions.append(final_q)

        final_questions.sort(key=lambda x: x["number"])

        # Save raw extraction
        raw_dir = output_dir / "raw"
        raw_dir.mkdir(exist_ok=True)
        with open(raw_dir / f"{year}_free_response.json", "w", encoding="utf-8") as f:
            json.dump({"year": year, "questions": final_questions}, f, indent=2, ensure_ascii=False)

        print(f"  {year}: Extracted {len(final_questions)} free-response questions")
        return final_questions

    except json.JSONDecodeError as e:
        print(f"  {year}: JSON parse error - {e}")
        return []
    except Exception as e:
        print(f"  {year}: API error - {e}")
        return []


def main():
    client = anthropic.Anthropic()

    base_dir = Path(__file__).parent.parent
    pdf_dir = base_dir / "CAP_Exams"
    output_dir = base_dir / "data"
    output_dir.mkdir(exist_ok=True)

    print("Extracting FREE-RESPONSE questions using Claude API")
    print("=" * 60)

    all_fr_questions = []

    # Process specific year or all
    years_to_process = ALL_YEARS
    if len(sys.argv) > 1:
        try:
            years_to_process = [int(sys.argv[1])]
        except ValueError:
            pass

    for year in years_to_process:
        # Skip if already extracted
        raw_file = output_dir / "raw" / f"{year}_free_response.json"
        if raw_file.exists():
            print(f"  {year}: Already extracted, loading...")
            with open(raw_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            all_fr_questions.extend(data["questions"])
            continue

        questions = extract_free_response(client, year, pdf_dir, output_dir)
        all_fr_questions.extend(questions)

    # Save combined free-response file
    output_file = output_dir / "free_response_questions.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "total_questions": len(all_fr_questions),
            "years": sorted(set(q["year"] for q in all_fr_questions)),
            "questions": all_fr_questions
        }, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 60)
    print(f"Total: {len(all_fr_questions)} free-response questions saved to {output_file}")
    print(f"\nNext step: Run enrich_free_response.py to add solutions and topics")
    print(f"Then run merge_into_database.py to combine with MC questions")


if __name__ == "__main__":
    main()
