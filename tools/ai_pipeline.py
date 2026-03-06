"""
AI Pipeline for CAP Exam Questions
- Verifies transcription accuracy
- Identifies and crops diagrams
- Generates step-by-step solutions
- Tags questions with topics
"""
import anthropic
import base64
import json
import os
import sys
import re
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

# Topic taxonomy (seed topics - AI can suggest new ones)
TOPICS = {
    "mechanics": ["kinematics", "dynamics", "energy", "momentum", "rotation", "shm", "gravity"],
    "waves_optics": ["wave_properties", "sound", "reflection", "refraction", "lenses", "mirrors", "interference", "diffraction"],
    "thermodynamics": ["heat", "phase_changes", "ideal_gas", "first_law", "entropy"],
    "electromagnetism": ["electrostatics", "electric_potential", "capacitors", "dc_circuits", "magnetism", "induction", "ac_circuits"],
    "modern_physics": ["relativity", "photoelectric", "atomic", "nuclear"],
    "fluids": ["pressure", "buoyancy", "fluid_dynamics"]
}

PIPELINE_PROMPT = """You are analyzing a physics exam question from the CAP High School Prize Exam.

## Current Extracted Data:
Question ID: {question_id}
Year: {year}
Question #{number}

Extracted Text:
{text}

Extracted Choices:
{choices}

## Your Tasks:

### 1. VERIFY TRANSCRIPTION
Look at the PDF page image and compare with the extracted text above.
- Is the question text accurate and complete?
- Are all answer choices correct?
- Note any errors or missing content.

### 2. DIAGRAM ANALYSIS
- Does this question have a diagram/figure/graph/circuit?
- If YES, describe the diagram and provide bounding box coordinates as percentages of image dimensions:
  {{"has_diagram": true, "bbox": [x1%, y1%, x2%, y2%], "description": "..."}}
- If NO: {{"has_diagram": false}}

### 3. SOLUTION
Provide a complete step-by-step solution:
- State the relevant physics concepts
- List equations used (in LaTeX)
- Show calculation steps
- State the final answer (letter choice)

### 4. TOPIC TAGS
Tag with relevant topics from this taxonomy:
- mechanics: kinematics, dynamics, energy, momentum, rotation, shm, gravity
- waves_optics: wave_properties, sound, reflection, refraction, lenses, mirrors, interference, diffraction
- thermodynamics: heat, phase_changes, ideal_gas, first_law, entropy
- electromagnetism: electrostatics, electric_potential, capacitors, dc_circuits, magnetism, induction, ac_circuits
- modern_physics: relativity, photoelectric, atomic, nuclear
- fluids: pressure, buoyancy, fluid_dynamics

Use format: ["category.subtopic", "category.subtopic"]
You may suggest new subtopics if needed (prefix with NEW:)

### 5. DIFFICULTY
Rate 1-5:
1 = Basic recall/formula application
2 = Single concept application
3 = Multi-step, single concept
4 = Multiple concepts combined
5 = Complex multi-step reasoning

## Response Format (JSON only):
```json
{{
  "verification": {{
    "text_accurate": true/false,
    "choices_accurate": true/false,
    "corrected_text": "..." or null,
    "corrected_choices": {{}} or null,
    "notes": "any issues found"
  }},
  "diagram": {{
    "has_diagram": true/false,
    "bbox": [x1, y1, x2, y2] or null,
    "description": "..." or null
  }},
  "solution": {{
    "concepts": ["concept1", "concept2"],
    "equations": ["$equation1$", "$equation2$"],
    "steps": ["Step 1: ...", "Step 2: ..."],
    "answer": "a/b/c/d/e",
    "explanation": "Brief explanation of answer"
  }},
  "topics": ["mechanics.kinematics", "mechanics.energy"],
  "difficulty": 3
}}
```

Return ONLY valid JSON, no other text."""


def load_page_image(year, page):
    """Load a page image and return as base64"""
    img_path = IMAGES_DIR / str(year) / f"page_{page}.png"
    if not img_path.exists():
        return None

    with open(img_path, "rb") as f:
        return base64.standard_b64encode(f.read()).decode("utf-8")


def crop_diagram(year, page, bbox, question_id):
    """Crop diagram from page image using bbox percentages"""
    img_path = IMAGES_DIR / str(year) / f"page_{page}.png"
    if not img_path.exists() or not bbox:
        return None

    img = Image.open(img_path)
    width, height = img.size

    # Convert percentage bbox to pixels
    x1 = int(bbox[0] / 100 * width)
    y1 = int(bbox[1] / 100 * height)
    x2 = int(bbox[2] / 100 * width)
    y2 = int(bbox[3] / 100 * height)

    # Crop
    cropped = img.crop((x1, y1, x2, y2))

    # Convert to base64
    buffer = io.BytesIO()
    cropped.save(buffer, format="PNG")
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")


def process_question(client, question):
    """Process a single question through the AI pipeline"""
    q_id = question["id"]
    year = question["year"]
    page = question.get("page", 1)

    # Load page image
    image_b64 = load_page_image(year, page)
    if not image_b64:
        print(f"    Warning: No image for page {page}")
        return None

    # Format choices for prompt
    choices_str = ""
    if question.get("choices"):
        for letter, text in question["choices"].items():
            choices_str += f"  {letter}) {text}\n"
    else:
        choices_str = "  (no choices extracted)"

    # Build prompt
    prompt = PIPELINE_PROMPT.format(
        question_id=q_id,
        year=year,
        number=question["number"],
        text=question.get("text", "(no text)"),
        choices=choices_str
    )

    try:
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64
                        }
                    },
                    {"type": "text", "text": prompt}
                ]
            }]
        )

        content = response.content[0].text

        # Extract JSON
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        result = json.loads(content.strip())

        # Crop diagram if found
        diagram_info = result.get("diagram", {})
        if diagram_info.get("has_diagram"):
            bbox = diagram_info.get("bbox")
            if bbox:
                diagram_b64 = crop_diagram(year, page, bbox, q_id)
                if diagram_b64:
                    result["diagram"]["image_data"] = diagram_b64
                    print(f"[Diagram cropped: bbox={bbox}]", end=" ")
                else:
                    print(f"[Diagram crop FAILED: bbox={bbox}]", end=" ")
            else:
                print(f"[Diagram detected but NO BBOX]", end=" ")

        return result

    except json.JSONDecodeError as e:
        print(f"    JSON error: {e}")
        return None
    except Exception as e:
        print(f"    API error: {e}")
        return None


def update_question(question, result):
    """Update question with pipeline results"""
    if not result:
        return question

    # Verification - update text if corrected
    verification = result.get("verification", {})
    if verification.get("corrected_text"):
        question["text"] = verification["corrected_text"]
    if verification.get("corrected_choices"):
        question["choices"] = verification["corrected_choices"]
    question["verified"] = verification.get("text_accurate", False) and verification.get("choices_accurate", False)

    # Diagram
    diagram = result.get("diagram", {})
    question["has_diagram"] = diagram.get("has_diagram", False)
    question["diagram_description"] = diagram.get("description", "")
    if diagram.get("image_data"):
        question["diagram_image"] = f"data:image/png;base64,{diagram['image_data']}"

    # Solution
    solution = result.get("solution", {})
    question["correct_answer"] = solution.get("answer")
    question["solution"] = {
        "concepts": solution.get("concepts", []),
        "equations": solution.get("equations", []),
        "steps": solution.get("steps", []),
        "explanation": solution.get("explanation", "")
    }

    # Topics and difficulty
    question["topics"] = result.get("topics", [])
    question["difficulty"] = result.get("difficulty")
    question["equations"] = solution.get("equations", [])

    # Mark as processed
    question["ai_processed"] = True

    return question


def main():
    # Load questions
    questions_file = DATA_DIR / "questions.json"
    with open(questions_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data["questions"]
    total = len(questions)

    print(f"AI Pipeline - Processing {total} questions")
    print("=" * 60)

    client = anthropic.Anthropic()

    # Process questions (can filter by year or limit for testing)
    processed = 0
    errors = 0

    # For testing, limit to first N questions or specific year
    # questions_to_process = [q for q in questions if q["year"] == 1994][:5]
    questions_to_process = questions  # Process all

    for i, question in enumerate(questions_to_process):
        q_id = question["id"]

        # Skip if already processed
        if question.get("ai_processed"):
            print(f"[{i+1}/{len(questions_to_process)}] {q_id}: Already processed, skipping")
            continue

        print(f"[{i+1}/{len(questions_to_process)}] {q_id}: Processing...", end=" ", flush=True)

        result = process_question(client, question)

        if result:
            update_question(question, result)
            processed += 1

            # Show brief summary
            answer = result.get("solution", {}).get("answer", "?")
            topics = result.get("topics", [])[:2]
            difficulty = result.get("difficulty", "?")
            has_diagram = result.get("diagram", {}).get("has_diagram", False)

            print(f"Answer: {answer}, Topics: {topics}, Difficulty: {difficulty}, Diagram: {has_diagram}")
        else:
            errors += 1
            print("FAILED")

        # Save progress after EVERY question (in case of interruption)
        with open(questions_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        if (i + 1) % 10 == 0:
            print(f"    [Progress: {processed} processed, {errors} errors]")

    # Final save
    with open(questions_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("=" * 60)
    print(f"Complete! Processed: {processed}, Errors: {errors}")
    print(f"Results saved to {questions_file}")


if __name__ == "__main__":
    main()
