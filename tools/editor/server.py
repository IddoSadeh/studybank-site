"""
Question Editor Server — local proxy for Claude API + question editing.
Run: python tools/editor/server.py
Requires: pip install flask anthropic
"""
import json
import os
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
import anthropic

# Load .env file from project root
EDITOR_DIR = Path(__file__).parent
PROJECT_ROOT = EDITOR_DIR.parent.parent
env_path = PROJECT_ROOT / ".env"
if env_path.exists():
    for line in env_path.read_text().strip().splitlines():
        if "=" in line and not line.startswith("#"):
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())

# Paths
QUESTIONS_JSON = PROJECT_ROOT / "data" / "questions.json"
SITE_QUESTIONS_JSON = PROJECT_ROOT / "web" / "data" / "questions.json"
VISUALIZATIONS_DIR = PROJECT_ROOT / "web" / "visualizations"

app = Flask(__name__, static_folder=str(EDITOR_DIR))
client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY from env


# --- Static files ---

@app.route("/")
def index():
    return send_from_directory(str(EDITOR_DIR), "index.html")


@app.route("/<path:filename>")
def static_files(filename):
    return send_from_directory(str(EDITOR_DIR), filename)


# --- Questions API ---

@app.route("/api/questions")
def get_questions():
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    return jsonify(data)


@app.route("/api/questions/<question_id>", methods=["PUT"])
def update_question(question_id):
    updates = request.json
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    found = False
    for q in data["questions"]:
        if q["id"] == question_id:
            for key, value in updates.items():
                q[key] = value
            found = True
            break

    if not found:
        return jsonify({"error": "Question not found"}), 404

    with open(QUESTIONS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    # Also update site copy
    with open(SITE_QUESTIONS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    return jsonify({"ok": True})


# --- Chat API (Claude proxy) ---

@app.route("/api/chat", methods=["POST"])
def chat():
    body = request.json
    messages = body.get("messages", [])
    system = body.get("system", "")
    model = body.get("model", "claude-sonnet-4-20250514")

    try:
        response = client.messages.create(
            model=model,
            max_tokens=8192,
            system=system,
            messages=messages,
        )
        return jsonify({
            "content": response.content[0].text,
            "usage": {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
            }
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Visualization save ---

@app.route("/api/save-viz", methods=["POST"])
def save_viz():
    body = request.json
    filename = body.get("filename", "").strip()
    html = body.get("html", "")
    question_id = body.get("question_id")  # None for concept-level
    scope = body.get("scope", "concept")   # 'question' | 'concept'

    if not filename or not filename.endswith(".html"):
        return jsonify({"error": "Filename must end with .html"}), 400

    # Sanitize filename
    safe_name = Path(filename).name
    dest = VISUALIZATIONS_DIR / safe_name
    dest.write_text(html, encoding="utf-8")

    # Update viz index metadata
    index_path = VISUALIZATIONS_DIR / "index.json"
    index = {}
    if index_path.exists():
        index = json.loads(index_path.read_text(encoding="utf-8"))
    index[safe_name] = {
        "scope": scope,
        "question_id": question_id,
        "filename": safe_name,
    }
    index_path.write_text(json.dumps(index, indent=2), encoding="utf-8")

    return jsonify({"ok": True, "path": str(dest)})


if __name__ == "__main__":
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Warning: ANTHROPIC_API_KEY not set. Chat features will fail.")
    print(f"Editor server starting...")
    print(f"  Questions: {QUESTIONS_JSON}")
    print(f"  Open: http://localhost:5000")
    app.run(host="localhost", port=5000, debug=True)
