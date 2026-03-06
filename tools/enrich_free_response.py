"""
AI Pipeline for free-response questions.
Adds solutions, topic tags, and difficulty ratings to extracted FR questions.
"""
import anthropic
import base64
import json
import os
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

# API key resolved by SDK (env var, config file, or keyring)

BASE_DIR = Path(__file__).parent.parent
IMAGES_DIR = BASE_DIR / "images"
DATA_DIR = BASE_DIR / "data"

PIPELINE_PROMPT = """You are analyzing a FREE-RESPONSE physics problem from the CAP High School Prize Exam.

## Question Data:
Question ID: {question_id}
Year: {year}, Section B, Question #{number}

Problem Text:
{text}

Sub-parts:
{parts}

Given Data:
{given_data}

## Your Tasks:

### 1. VERIFY TRANSCRIPTION
Look at the PDF page image(s) and compare with the extracted text.
- Is the problem statement complete and accurate?
- Are all sub-parts captured correctly?
- Note any missing content.

### 2. SOLUTION
For EACH sub-part (or the whole problem if no parts), provide:
- The physics concepts involved
- Key equations (LaTeX)
- Step-by-step solution approach
- Final answer or result

### 3. TOPIC TAGS
Tag with topics from:
- mechanics: kinematics, dynamics, energy, momentum, rotation, shm, gravity, statics
- waves_optics: wave_properties, sound, reflection, refraction, lenses, mirrors, interference, diffraction
- thermodynamics: heat, phase_changes, ideal_gas, first_law, entropy
- electromagnetism: electrostatics, electric_potential, capacitors, dc_circuits, magnetism, induction, ac_circuits
- modern_physics: relativity, photoelectric, atomic, nuclear
- fluids: pressure, buoyancy, fluid_dynamics

Format: ["category.subtopic", ...]
Prefix new subtopics with NEW:

### 4. DIFFICULTY
Rate 1-5:
1 = Basic single-concept
2 = Multi-step, single concept
3 = Multiple concepts combined
4 = Complex multi-step reasoning
5 = Research-level / open-ended design problems

## Response Format (JSON only):
```json
{{
  "verification": {{
    "text_accurate": true,
    "corrected_text": null,
    "corrected_parts": null,
    "notes": ""
  }},
  "solution": {{
    "concepts": ["concept1", "concept2"],
    "equations": ["$equation1$", "$equation2$"],
    "parts": [
      {{
        "label": "a",
        "approach": "Brief description of approach",
        "steps": ["Step 1: ...", "Step 2: ..."],
        "answer": "Final result or expression"
      }}
    ],
    "explanation": "Overall explanation of the problem"
  }},
  "topics": ["mechanics.kinematics"],
  "difficulty": 4
}}
```

If the question has no sub-parts, put the full solution in a single part with label "main".
Return ONLY valid JSON."""


def load_page_image(year, page):
    """Load a page image and return as base64"""
    img_path = IMAGES_DIR / str(year) / f"page_{page}.png"
    if not img_path.exists():
        return None
    with open(img_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def get_fr_page_images(year):
    """Get base64 images for the Section B pages of a given year.
    Section B is typically the last 3-4 pages of the exam."""
    year_dir = IMAGES_DIR / str(year)
    if not year_dir.exists():
        return []

    # Find all page images
    pages = sorted(year_dir.glob("page_*.png"), key=lambda p: int(p.stem.split("_")[1]))
    total = len(pages)

    if total == 0:
        return []

    # Section B is roughly the last third of the exam
    # MC takes ~5-7 pages, FR takes ~3-4 pages
    start = max(total // 2, 3)

    images = []
    for p in pages[start:]:
        with open(p, "rb") as f:
            images.append(base64.standard_b64encode(f.read()).decode("utf-8"))

    return images


def process_question(client, question):
    """Process a single FR question through the AI pipeline"""
    year = question["year"]

    # Get page images for context
    page_images = get_fr_page_images(year)

    # Format parts
    parts_str = ""
    if question.get("parts"):
        for p in question["parts"]:
            parts_str += f"  ({p['label']}) {p['text']}\n"
    else:
        parts_str = "  (No labeled sub-parts — single open-ended problem)"

    prompt = PIPELINE_PROMPT.format(
        question_id=question["id"],
        year=year,
        number=question["number"],
        text=question.get("text", "(no text)"),
        parts=parts_str,
        given_data=question.get("given_data", "(none)")
    )

    # Build content blocks with images
    content_blocks = []
    for img_b64 in page_images[:4]:  # Max 4 images to stay within limits
        content_blocks.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/png",
                "data": img_b64
            }
        })
    content_blocks.append({"type": "text", "text": prompt})

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=8192,
            messages=[{"role": "user", "content": content_blocks}]
        )

        content = response.content[0].text

        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        return json.loads(content.strip())

    except json.JSONDecodeError as e:
        print(f"    JSON error: {e}")
        return None
    except Exception as e:
        print(f"    API error: {e}")
        return None


def update_question(question, result):
    """Update FR question with pipeline results"""
    if not result:
        return question

    # Verification
    verification = result.get("verification", {})
    if verification.get("corrected_text"):
        question["text"] = verification["corrected_text"]
    if verification.get("corrected_parts"):
        question["parts"] = verification["corrected_parts"]
    question["verified"] = verification.get("text_accurate", False)

    # Solution
    solution = result.get("solution", {})
    question["solution"] = {
        "concepts": solution.get("concepts", []),
        "equations": solution.get("equations", []),
        "parts": solution.get("parts", []),
        "explanation": solution.get("explanation", "")
    }
    question["equations"] = solution.get("equations", [])

    # Topics and difficulty
    question["topics"] = result.get("topics", [])
    question["difficulty"] = result.get("difficulty")

    question["ai_processed"] = True
    return question


def main():
    # Load free-response questions
    fr_file = DATA_DIR / "free_response_questions.json"
    if not fr_file.exists():
        print("Error: free_response_questions.json not found.")
        print("Run extract_free_response.py first.")
        sys.exit(1)

    with open(fr_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data["questions"]
    total = len(questions)

    print(f"AI Pipeline - Enriching {total} free-response questions")
    print("=" * 60)

    client = anthropic.Anthropic()

    processed = 0
    errors = 0

    for i, question in enumerate(questions):
        q_id = question["id"]

        if question.get("ai_processed"):
            print(f"[{i+1}/{total}] {q_id}: Already processed, skipping")
            continue

        print(f"[{i+1}/{total}] {q_id}: Processing...", end=" ", flush=True)

        result = process_question(client, question)

        if result:
            update_question(question, result)
            processed += 1
            topics = result.get("topics", [])[:2]
            difficulty = result.get("difficulty", "?")
            print(f"Topics: {topics}, Difficulty: {difficulty}")
        else:
            errors += 1
            print("FAILED")

        # Save after every question
        with open(fr_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    print("=" * 60)
    print(f"Complete! Processed: {processed}, Errors: {errors}")
    print(f"\nNext step: Run merge_into_database.py to combine with MC questions")


if __name__ == "__main__":
    main()
