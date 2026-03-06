"""
Extract questions from CAP exam PDFs using Claude API with vision.
Handles both scanned and digital PDFs consistently.
"""
import anthropic
import base64
import json
import os
import sys
from pathlib import Path
from pdf2image import convert_from_path

sys.stdout.reconfigure(encoding='utf-8')

# All years to process
ALL_YEARS = list(range(1994, 2020)) + [2022, 2023, 2024, 2025]

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
      "b": "Choice B text",
      "c": "Choice C text",
      "d": "Choice D text",
      "e": "Choice E text"
    },
    "has_diagram": true,
    "diagram_description": "Description of diagram if present"
  }
]
```

Rules:
- Extract ALL questions visible, even partial ones (mark with "partial": true)
- Preserve mathematical notation (use LaTeX: $v = v_0 + at$)
- Preserve Greek letters (α, β, θ, etc.)
- Preserve subscripts/superscripts in equations
- If a question continues from previous page, include what's visible
- Skip headers, footers, instructions, and constants tables
- Return empty array [] if no questions on this page

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


def extract_questions_from_page(client, image, page_num):
    """Send image to Claude and extract questions"""
    base64_image = image_to_base64(image)

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": base64_image
                            }
                        },
                        {
                            "type": "text",
                            "text": EXTRACTION_PROMPT
                        }
                    ]
                }
            ]
        )

        # Parse response
        content = response.content[0].text

        # Extract JSON from response
        # Handle potential markdown code blocks
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        questions = json.loads(content.strip())
        return questions

    except json.JSONDecodeError as e:
        print(f"    Page {page_num}: JSON parse error - {e}")
        return []
    except Exception as e:
        print(f"    Page {page_num}: API error - {e}")
        return []


def extract_year(client, year, pdf_dir, output_dir):
    """Extract all questions from one year's exam"""
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

    # Process questions - assign IDs, deduplicate
    seen_numbers = set()
    final_questions = []

    for q in all_questions:
        q_num = q.get("number")
        if q_num and q_num not in seen_numbers:
            seen_numbers.add(q_num)

            # Build final question object
            final_q = {
                "id": f"{year}_Q{q_num:02d}",
                "year": year,
                "number": q_num,
                "text": q.get("text", ""),
                "choices": q.get("choices", {}),
                "has_diagram": q.get("has_diagram", False),
                "diagram_description": q.get("diagram_description", ""),
                "correct_answer": None,
                "solution": None,
                "topics": [],
                "equations": [],
                "difficulty": None,
                "verified": False,
                "extraction_quality": "claude"
            }
            final_questions.append(final_q)

    # Sort by question number
    final_questions.sort(key=lambda x: x["number"])

    # Save individual year file
    raw_dir = output_dir / "raw"
    raw_dir.mkdir(exist_ok=True)

    with open(raw_dir / f"{year}_questions.json", "w", encoding="utf-8") as f:
        json.dump({"year": year, "questions": final_questions}, f, indent=2, ensure_ascii=False)

    print(f"  {year}: Extracted {len(final_questions)} questions")
    return final_questions


def main():
    # Check for API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        print("Set it with: set ANTHROPIC_API_KEY=your-key-here")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # Use absolute paths
    base_dir = Path(__file__).parent.parent
    pdf_dir = base_dir / "CAP_Exams"
    output_dir = base_dir / "data"
    output_dir.mkdir(exist_ok=True)

    print("Extracting questions using Claude API\n")
    print("="*50)

    all_questions = []

    # Process specific years or all
    years_to_process = ALL_YEARS

    # Check for command line argument to process specific year
    if len(sys.argv) > 1:
        try:
            years_to_process = [int(sys.argv[1])]
        except ValueError:
            pass

    for year in years_to_process:
        questions = extract_year(client, year, pdf_dir, output_dir)
        all_questions.extend(questions)

    # Save combined file
    output_file = output_dir / "questions.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "total_questions": len(all_questions),
            "years": sorted(set(q["year"] for q in all_questions)),
            "questions": all_questions
        }, f, indent=2, ensure_ascii=False)

    print("\n" + "="*50)
    print(f"Total: {len(all_questions)} questions saved to {output_file}")


if __name__ == "__main__":
    main()
