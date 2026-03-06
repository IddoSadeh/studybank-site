"""
Extract questions from digital CAP exam PDFs using pdfplumber.
Outputs structured JSON for each year.
"""
import pdfplumber
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')

# Years with digital (text-extractable) PDFs
DIGITAL_YEARS = list(range(1999, 2020)) + [2022, 2023, 2024, 2025]

def extract_text_from_pdf(pdf_path):
    """Extract all text from a PDF"""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n\n"
    return text

def parse_questions(text, year):
    """Parse extracted text into structured questions"""
    questions = []

    # Clean up common PDF artifacts
    text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
    text = re.sub(r'(\d+)\s*\)', r'\n\1)', text)  # Put question numbers on new lines

    # Find all questions using pattern: number followed by )
    # Questions are numbered 1-25 typically for Section A
    question_pattern = r'(\d{1,2})\)\s*(.+?)(?=\d{1,2}\)|Section\s*B|$)'

    matches = re.findall(question_pattern, text, re.DOTALL)

    for q_num_str, q_content in matches:
        q_num = int(q_num_str)
        if q_num > 30:  # Skip if number is too high (likely not a question)
            continue

        q_content = q_content.strip()

        # Try to extract choices a) b) c) d) e)
        choices = {}
        choice_pattern = r'([a-f])\)\s*(.+?)(?=[a-f]\)|$)'
        choice_matches = re.findall(choice_pattern, q_content, re.DOTALL | re.IGNORECASE)

        for letter, choice_text in choice_matches:
            choice_text = choice_text.strip()
            # Clean up choice text - remove trailing numbers that are next question
            choice_text = re.sub(r'\s+\d{1,2}$', '', choice_text)
            if choice_text:
                choices[letter.lower()] = choice_text

        # Extract question text (before choices)
        q_text = q_content
        if choices:
            first_choice = re.search(r'[aA]\)', q_content)
            if first_choice:
                q_text = q_content[:first_choice.start()].strip()

        # Skip if question text is too short (probably parsing error)
        if len(q_text) < 10:
            continue

        # Create question object
        question = {
            "id": f"{year}_Q{q_num:02d}",
            "year": year,
            "number": q_num,
            "text": q_text,
            "choices": choices if choices else {},
            "correct_answer": None,
            "solution": None,
            "topics": [],
            "equations": [],
            "difficulty": None,
            "verified": False,
            "extraction_quality": "auto"  # Mark as auto-extracted for review
        }

        questions.append(question)

    # Sort by question number and remove duplicates
    seen = set()
    unique_questions = []
    for q in sorted(questions, key=lambda x: x["number"]):
        if q["number"] not in seen:
            seen.add(q["number"])
            unique_questions.append(q)

    return unique_questions

def extract_year(year, pdf_dir, output_dir):
    """Extract questions from a single year's exam"""
    exam_path = pdf_dir / f"{year}_exam.pdf"

    if not exam_path.exists():
        print(f"  {year}: Exam PDF not found")
        return None

    print(f"  {year}: Extracting...", end=" ")

    # Extract text
    text = extract_text_from_pdf(exam_path)

    # Parse questions
    questions = parse_questions(text, year)

    # Save raw text for debugging
    raw_dir = output_dir / "raw"
    raw_dir.mkdir(exist_ok=True)
    with open(raw_dir / f"{year}_raw.txt", "w", encoding="utf-8") as f:
        f.write(text)

    # Save questions JSON
    with open(raw_dir / f"{year}_questions.json", "w", encoding="utf-8") as f:
        json.dump({"year": year, "questions": questions}, f, indent=2, ensure_ascii=False)

    print(f"Found {len(questions)} questions")
    return questions

def main():
    pdf_dir = Path(__file__).parent.parent / "CAP_Exams"
    output_dir = Path(__file__).parent.parent / "data"
    output_dir.mkdir(exist_ok=True)

    print("Extracting questions from digital PDFs\n")

    all_questions = []

    for year in DIGITAL_YEARS:
        questions = extract_year(year, pdf_dir, output_dir)
        if questions:
            all_questions.extend(questions)

    # Save combined questions
    output_file = output_dir / "questions.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "total_questions": len(all_questions),
            "years": sorted(set(q["year"] for q in all_questions)),
            "questions": all_questions
        }, f, indent=2, ensure_ascii=False)

    print(f"\nTotal: {len(all_questions)} questions saved to {output_file}")

if __name__ == "__main__":
    main()
