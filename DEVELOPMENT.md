# Study Bank

828 questions (736 multiple-choice + 92 free-response) from the Canadian Association of Physicists High School Prize Exam (1994-2025).

```
web/          <-- open index.html to use
  pdfs/        <-- original exam + solution PDFs
tools/         <-- one-time processing scripts
data/          <-- master question database
```

Run locally: `python -m http.server` in `web/`

---

## Architecture

```
                        ┌──────────────────────────────────┐
                        │           Browser (web/)         │
                        │                                   │
                        │  index.html ── app.js ── style.css│
                        │       │                           │
                        │       ▼                           │
                        │  data/questions.json  (2.1 MB)    │
                        │  pdfs/*.pdf           (originals) │
                        └──────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────┐
  │              Data Pipeline (tools/)                          │
  │                                                             │
  │  CAP Website                                                │
  │      │                                                      │
  │      ▼                                                      │
  │  download_pdfs.py ──► CAP_Exams/*.pdf                       │
  │                            │                                │
  │                            ▼                                │
  │  ┌─── Multiple Choice (Section A) ───┐                      │
  │  │  extract_with_claude.py           │                      │
  │  │  extract_digital.py               │──► data/raw/*.json   │
  │  │  extract_missing.py               │                      │
  │  │           │                       │                      │
  │  │           ▼                       │                      │
  │  │  ai_pipeline.py ──► questions.json│                      │
  │  └───────────────────────────────────┘                      │
  │                                                             │
  │  ┌─── Free Response (Section B) ─────┐                      │
  │  │  extract_free_response.py         │                      │
  │  │           │                       │──► data/raw/*.json   │
  │  │           ▼                       │                      │
  │  │  enrich_free_response.py          │                      │
  │  │  (solutions, topics, difficulty)  │                      │
  │  └───────────────────────────────────┘                      │
  │                            │                                │
  │                            ▼                                │
  │  merge_into_database.py ──► data/questions.json             │
  │                            │                                │
  │                            ▼                                │
  │          merge_into_database.py auto-copies to web/data/    │
  └─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
studybank/
├── web/                       # Static website (serve this)
│   ├── index.html              #   Cascading filter UI + question list
│   ├── app.js                  #   Filter logic, rendering, LaTeX
│   ├── style.css               #   Single-column responsive design
│   ├── about.html              #   About page
│   ├── analytics.html/.js      #   Analytics dashboard
│   ├── visualizations.html     #   Gallery of p5.js physics demos
│   ├── visualizations/         #   p5.js demo HTML files + index.json
│   ├── data/questions.json     #   Copy of master DB
│   └── pdfs/                   #   58 PDFs (exam + solutions per year)
│
├── data/
│   ├── questions.json          #   Master database (828 questions)
│   ├── free_response_questions.json  #  FR questions before merge
│   ├── page_mapping.json       #   Question → PDF page numbers
│   └── raw/                    #   Per-year extraction artifacts
│       ├── {year}_questions.json       # MC extractions
│       ├── {year}_free_response.json   # FR extractions
│       └── {year}_raw.txt              # Raw PDF text
│
├── tools/
│   ├── download_pdfs.py        #   Scrape PDFs from CAP/UBC site
│   ├── extract_with_claude.py  #   MC extraction via Claude vision
│   ├── extract_digital.py      #   MC extraction from text-based PDFs
│   ├── extract_missing.py      #   Re-extract incomplete years
│   ├── ai_pipeline.py          #   MC solutions + topics + difficulty
│   ├── extract_free_response.py  # FR extraction via Claude vision
│   ├── enrich_free_response.py #   FR solutions + topics + difficulty
│   ├── merge_into_database.py  #   Combine MC + FR into one database
│   ├── map_questions_to_pages.py  # Question → page mapping
│   ├── fix_1997.py             #   One-off fix for corrupted 1997 Q6-Q25
│   ├── verify.html             #   Manual review dashboard
│   └── editor/                 #   Local question editor + viz tool
│       ├── server.py           #     Flask server (Claude API proxy)
│       ├── index.html          #     Three-panel editor UI
│       ├── editor.js           #     Editor logic + chat + viz
│       └── editor.css          #     Dark theme styles
│
├── images/                     #   PDF pages as PNGs (30 year dirs)
├── CAP_Exams/                  #   Source PDFs (exam + solutions)
├── .gitignore
└── DEVELOPMENT.md
```

---

## Question Schema

### Multiple Choice (Section A)

```json
{
  "id":          "2024_Q15",
  "year":        2024,
  "number":      15,
  "question_type": "multiple_choice",
  "section":     "A",
  "text":        "A ball is thrown...",
  "choices":     { "a": "10 m/s", "b": "20 m/s", "c": "30 m/s", "d": "40 m/s" },
  "correct_answer": "b",

  "topics":      ["mechanics.kinematics", "mechanics.dynamics"],
  "difficulty":  3,
  "has_diagram":        true,
  "diagram_description": "Ball trajectory with angle theta",

  "solution": {
    "concepts":    ["projectile motion"],
    "equations":   ["$v = v_0 + at$"],
    "steps":       ["Step 1: ...", "Step 2: ..."],
    "explanation": "Using kinematics..."
  },

  "page":        2,
  "subject":     "physics",
  "source":      "cap",
  "ai_processed": true,
  "verified":     false
}
```

### Free Response (Section B)

```json
{
  "id":          "2024_FR1",
  "year":        2024,
  "number":      1,
  "question_type": "free_response",
  "section":     "B",
  "text":        "Consider a spacecraft...",
  "parts": [
    { "label": "a", "text": "Find the velocity..." },
    { "label": "b", "text": "Calculate the force..." }
  ],
  "given_data":  "Mass m = 500 kg, radius R = 6371 km",
  "choices":     {},
  "correct_answer": null,

  "topics":      ["mechanics.gravity", "mechanics.energy"],
  "difficulty":  4,
  "has_diagram":        true,
  "diagram_description": "Spacecraft in orbit around Earth",

  "solution": {
    "concepts":    ["orbital mechanics", "conservation of energy"],
    "equations":   ["$F = GMm/r^2$"],
    "parts": [
      {
        "label": "a",
        "approach": "Use conservation of energy",
        "steps": ["Step 1: ...", "Step 2: ..."],
        "answer": "$v = \\sqrt{2GM/r}$"
      }
    ],
    "explanation": "This problem combines..."
  },

  "subject":     "physics",
  "source":      "cap",
  "ai_processed": true,
  "verified":     false
}
```

---

## Topic Taxonomy

```
mechanics         kinematics, dynamics, energy, momentum, rotation, shm, gravity, statics
electromagnetism  electrostatics, electric_potential, capacitors, dc_circuits, ac_circuits, magnetism, induction
waves_optics      wave_properties, sound, reflection, refraction, lenses, mirrors, interference, diffraction
thermodynamics    heat, phase_changes, ideal_gas, first_law, entropy
modern_physics    relativity, photoelectric, atomic, nuclear
fluids            pressure, buoyancy, fluid_dynamics
```

---

## Tools Quick Reference

All AI scripts require `ANTHROPIC_API_KEY` environment variable.

### Multiple Choice Pipeline

| Script | What it does | Run with |
|--------|-------------|----------|
| `download_pdfs.py` | Scrape exam PDFs from CAP site | `uv run --with requests --with pikepdf python tools/download_pdfs.py` |
| `extract_with_claude.py` | Extract MC questions via Claude vision | `uv run --with anthropic --with pdf2image --with pillow python tools/extract_with_claude.py` |
| `extract_digital.py` | Extract from text-based PDFs | `uv run --with pdfplumber python tools/extract_digital.py` |
| `ai_pipeline.py` | Generate MC solutions, topics, difficulty | `uv run --with anthropic --with pillow python tools/ai_pipeline.py` |

### Free Response Pipeline

| Script | What it does | Run with |
|--------|-------------|----------|
| `extract_free_response.py` | Extract FR questions via Claude vision | `uv run --with anthropic --with pdf2image --with pillow python tools/extract_free_response.py [year]` |
| `enrich_free_response.py` | Generate FR solutions, topics, difficulty | `uv run --with anthropic --with pillow python tools/enrich_free_response.py` |
| `merge_into_database.py` | Combine MC + FR into master database | `python tools/merge_into_database.py` |

### Utilities

| Script | What it does | Run with |
|--------|-------------|----------|
| `map_questions_to_pages.py` | Map questions to PDF pages | `uv run --with anthropic --with pillow python tools/map_questions_to_pages.py [year]` |
| `verify.html` | Manual review dashboard | Open in browser, load questions.json |

All pipelines are **resumable** — scripts skip already-processed questions.

### Editor Tool

```bash
cd studybank && python tools/editor/server.py
# Open http://localhost:5000
```

Three-panel local editor: question browser, detail editor, AI chat.
- **Edit mode**: Edit any field (text, choices, answer, topics, difficulty, solution). Chat can propose edits via structured `\`\`\`edit` blocks.
- **Visualize mode**: Full-screen overlay with p5.js sandbox. Generate question-level or concept-level physics visualizations. Saves to `web/visualizations/`.

---

## Website Features

### Cascading Filter UI

The site uses progressive disclosure with two browse paths:

```
Row 1 - Browse by: [Topic] [Exam]

Topic path:
  Subject:  [Physics]
  Topic:    [Mechanics] [E&M] [Waves] [Thermo] [Modern] [Fluids]
  Subtopic: [Kinematics] [Dynamics] [Energy] ...

Exam path:
  Source:   [CAP Prize Exam] [future sources...]
  Year:     [1994] [1995] ... [2025]  (multi-select chips)
  Topic:    (same topic/subtopic rows)

Always visible:
  Type:       [All] [Multiple Choice] [Free Response]
  Difficulty: [All] [1] [2] [3] [4] [5]
  Search bar
```

### Question Display

- **MC questions**: Show choices with expandable correct answer + step-by-step solution
- **FR questions**: Show sub-parts with given data, expandable part-by-part solutions
- **PDF links**: Each question links to original exam PDF + solutions PDF
- **Math**: KaTeX renders LaTeX inline and display
- **Performance**: Lazy loads 20 questions at a time

---

## Common Tasks

**Update site after data changes:**
`merge_into_database.py` auto-copies to `web/data/`. For manual sync: `cp data/questions.json web/data/`

**Add new exam year:**
1. Add PDF to `CAP_Exams/`
2. Extract MC: `python tools/extract_with_claude.py`
3. Process MC: `python tools/ai_pipeline.py`
4. Extract FR: `python tools/extract_free_response.py <year>`
5. Enrich FR: `python tools/enrich_free_response.py`
6. Merge: `python tools/merge_into_database.py`
7. Add PDF to `web/pdfs/`

**Add new problem source:**
1. Prepare JSON matching schema above, set `source: "new_id"`
2. Merge into `data/questions.json`
3. Source will auto-appear in Exam browse mode filter buttons

**Deploy to GitHub Pages:**
```bash
git subtree push --prefix web public-site main
```
Site: https://isadeh.com/studybank-site/

---

## Git Setup

- **Private repo** (`studybank`): full project — tools, data, editor
- **Public repo** (`studybank-site`): website only (contents of `web/`)
- Remote `origin` → private repo, remote `public-site` → public repo
- `git subtree push --prefix web public-site main` deploys `web/` to the public site

---

## Notes

- **No per-question images** — AI cropping proved unreliable. Users view original PDFs instead.
- **Page images** in `images/` kept for future cropping tool when AI vision improves.
- **2020-2021 missing** — no CAP exam those years (COVID).
- **2024-2025 solutions** — solution PDFs not yet available for these years.
- **questions.json is 2.1 MB** — small enough for client-side filtering, no backend needed.
- **FR solution format** differs from MC — uses `parts[]` array with per-part approach/steps/answer instead of flat steps.
