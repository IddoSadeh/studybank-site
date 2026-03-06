// ============================================================
// Question Editor — Main Logic
// ============================================================

// --- State ---
let allQuestions = [];
let filteredQuestions = [];
let currentQuestion = null;
let discussHistory = [];   // chat history for discuss mode
let vizHistory = [];        // chat history for visualize mode
let chatMode = 'discuss';   // 'discuss' | 'visualize'
let vizScope = 'question';  // 'question' | 'concept'
let lastVizHTML = '';

// --- P5.js Visualization System Prompt ---
const VIZ_SYSTEM_PROMPT = `You are an expert Physics Tutor and Creative Coder. Your goal is to build an interactive, step-by-step simulation using p5.js that visually demonstrates the physics concept.

Technical Constraints:
1. Output: A single, self-contained HTML file containing CSS, HTML, and JavaScript.
2. Library: Use p5.js via CDN (https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.2/p5.min.js).
3. Layout: Use a Sidebar Layout — Left sidebar with title, step description, buttons, toggles. Main area with the canvas.

Simulation Architecture (The "Solver" Pattern):
Do not hardcode coordinates for the solution. Write a "Physics Engine" that calculates results based on inputs.
1. Setup Phase: Define static geometry.
2. Calc Phase: Calculate all ray paths / positions before drawing.
3. Render Phase: Draw only what is relevant for the current step.

Pedagogical Standards:
- Step-by-step storytelling with a state machine (Step 0, 1, 2...). Users press "Next" to advance.
- Color Coding: Real Objects = Green, Virtual/Imaginary = Red, Light Rays = Blue or Yellow, Normals/Guides = Dashed Grey.
- Every light ray must have an arrowhead showing direction.
- Include "Previous" and "Next" buttons.
- Add checkboxes/toggles for complex visuals (e.g., "Show Normals").

Code Structure:
\`\`\`
// 1. CONFIGURATION
let step = 0;
const descriptions = ["Step 1: Setup...", "Step 2: Physics..."];
// 2. PHYSICS ENGINE
function calculatePhysics() { /* vector math, return scene object */ }
// 3. DRAW LOOP
function draw() { /* draw based on step variable */ }
\`\`\`

IMPORTANT: Return ONLY the complete HTML file, no explanation before or after. The HTML will be rendered directly in an iframe.`;

// ============================================================
// Init
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadQuestions();
    setupEventListeners();
});

async function loadQuestions() {
    const resp = await fetch('/api/questions');
    const data = await resp.json();
    allQuestions = data.questions;
    populateFilters();
    filterAndRender();
}

function populateFilters() {
    const yearSet = new Set(allQuestions.map(q => q.year));
    const topicSet = new Set();
    allQuestions.forEach(q => {
        (q.topics || []).forEach(t => {
            const subject = t.split('.')[0];
            topicSet.add(subject);
        });
    });

    const yearSelect = document.getElementById('filter-year');
    [...yearSet].sort((a, b) => b - a).forEach(y => {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    });

    const topicSelect = document.getElementById('filter-topic');
    [...topicSet].sort().forEach(t => {
        const label = t.charAt(0).toUpperCase() + t.slice(1);
        topicSelect.innerHTML += `<option value="${t}">${label}</option>`;
    });
}

function setupEventListeners() {
    document.getElementById('search-input').addEventListener('input', filterAndRender);
    document.getElementById('filter-year').addEventListener('change', filterAndRender);
    document.getElementById('filter-topic').addEventListener('change', filterAndRender);
    document.getElementById('filter-type').addEventListener('change', filterAndRender);

    // Enter-to-send on both chat inputs
    document.getElementById('chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
    document.getElementById('viz-chat-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
    });
}

// ============================================================
// Question Browser (Left Panel)
// ============================================================

function filterAndRender() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const year = document.getElementById('filter-year').value;
    const topic = document.getElementById('filter-topic').value;
    const type = document.getElementById('filter-type').value;

    filteredQuestions = allQuestions.filter(q => {
        if (year && q.year !== parseInt(year)) return false;
        if (topic && !(q.topics || []).some(t => t.startsWith(topic))) return false;
        if (type) {
            const isFR = q.id.includes('FR') || (q.parts && q.parts.length > 0);
            if (type === 'free_response' && !isFR) return false;
            if (type === 'multiple_choice' && isFR) return false;
        }
        if (search && !q.text.toLowerCase().includes(search) && !q.id.toLowerCase().includes(search)) return false;
        return true;
    });

    renderQuestionList();
}

function renderQuestionList() {
    const list = document.getElementById('question-list');
    list.innerHTML = filteredQuestions.map(q => `
        <div class="q-item ${currentQuestion && currentQuestion.id === q.id ? 'active' : ''}"
             onclick="selectQuestion('${q.id}')">
            <span class="q-item-id">${q.id}</span>
            <span class="q-item-text">${escapeHTML(q.text.substring(0, 80))}${q.text.length > 80 ? '...' : ''}</span>
        </div>
    `).join('');
}

function selectQuestion(id) {
    currentQuestion = allQuestions.find(q => q.id === id);
    renderQuestionList();
    renderDetail();
    // Reset both chat histories for new question
    discussHistory = [];
    vizHistory = [];
    lastVizHTML = '';
    renderChatMessages();
}

// ============================================================
// Question Detail (Center Panel)
// ============================================================

function renderDetail() {
    if (!currentQuestion) return;
    const q = currentQuestion;
    document.getElementById('detail-title').textContent = q.id;

    const isFR = q.parts && q.parts.length > 0;
    const sol = q.solution || {};

    let html = '';

    // Question text — editable
    html += `<div class="detail-section">
        <h3>Question Text</h3>
        <textarea class="edit-field" id="edit-text" rows="4">${escapeHTML(q.text)}</textarea>
    </div>`;

    // Choices (MC) — editable
    if (q.choices) {
        html += `<div class="detail-section"><h3>Choices</h3>`;
        for (const letter of Object.keys(q.choices)) {
            const isCorrect = q.correct_answer === letter;
            html += `<div class="choice-edit-row">
                <span class="choice-letter">${letter.toUpperCase()}.</span>
                <input type="text" class="edit-field-inline" id="edit-choice-${letter}" value="${escapeHTML(q.choices[letter])}">
                <label class="correct-radio"><input type="radio" name="correct-answer" value="${letter}" ${isCorrect ? 'checked' : ''}> ✓</label>
            </div>`;
        }
        html += `</div>`;
    }

    // Parts (FR) — editable
    if (isFR) {
        html += `<div class="detail-section"><h3>Parts</h3>`;
        q.parts.forEach((p, i) => {
            html += `<div style="margin-bottom:8px">
                <label style="font-size:0.78rem;color:#888;">${escapeHTML(p.label || p.part_id)}</label>
                <textarea class="edit-field" id="edit-part-${i}" rows="2">${escapeHTML(p.text)}</textarea>
            </div>`;
        });
        html += `</div>`;
    }

    // Solution — editable
    html += `<div class="detail-section"><h3>Solution</h3>`;

    html += `<label style="font-size:0.78rem;color:#888;">Concepts (comma-separated)</label>
        <textarea class="edit-field" id="edit-concepts" rows="2">${(sol.concepts || []).join(', ')}</textarea>`;

    html += `<label style="font-size:0.78rem;color:#888;margin-top:8px;display:block;">Equations (one per line)</label>
        <textarea class="edit-field" id="edit-equations" rows="3">${(sol.equations || []).join('\n')}</textarea>`;

    html += `<label style="font-size:0.78rem;color:#888;margin-top:8px;display:block;">Steps (one per line)</label>
        <textarea class="edit-field" id="edit-steps" rows="6">${(sol.steps || []).join('\n')}</textarea>`;

    html += `<label style="font-size:0.78rem;color:#888;margin-top:8px;display:block;">Explanation</label>
        <textarea class="edit-field" id="edit-explanation" rows="3">${sol.explanation || ''}</textarea>`;

    html += `</div>`;

    // Metadata — editable
    html += `<div class="detail-section"><h3>Metadata</h3>
        <label style="font-size:0.78rem;color:#888;">Topics (comma-separated, e.g. mechanics.kinematics, waves.optics)</label>
        <input type="text" class="edit-field-inline" id="edit-topics" value="${escapeHTML((q.topics || []).join(', '))}">
        <label style="font-size:0.78rem;color:#888;margin-top:6px;display:block;">Difficulty (1-5)</label>
        <input type="number" class="edit-field-inline" id="edit-difficulty" min="1" max="5" value="${q.difficulty || ''}" style="width:60px;">
        <div style="font-size:0.78rem;color:#555;margin-top:6px;">Year: ${q.year} | Number: ${q.number} | ID: ${q.id}</div>
    </div>`;

    document.getElementById('detail-content').innerHTML = html;

    // Add save bar if not already present
    const center = document.getElementById('panel-center');
    if (!center.querySelector('.save-bar')) {
        const bar = document.createElement('div');
        bar.className = 'save-bar';
        bar.innerHTML = `<button class="save-btn" onclick="saveQuestion()">Save Changes</button><span class="save-status" id="save-status"></span>`;
        center.appendChild(bar);
    }

    // Render math
    renderMathIn(document.getElementById('detail-content'));
}

async function saveQuestion() {
    if (!currentQuestion) return;
    const q = currentQuestion;

    // Gather all editable fields
    const updates = {};

    // Question text
    updates.text = document.getElementById('edit-text').value;

    // Choices + correct answer (MC)
    if (q.choices) {
        const choices = {};
        for (const letter of Object.keys(q.choices)) {
            const el = document.getElementById(`edit-choice-${letter}`);
            if (el) choices[letter] = el.value;
        }
        updates.choices = choices;
        const checked = document.querySelector('input[name="correct-answer"]:checked');
        if (checked) updates.correct_answer = checked.value;
    }

    // Parts (FR)
    if (q.parts && q.parts.length > 0) {
        updates.parts = q.parts.map((p, i) => {
            const el = document.getElementById(`edit-part-${i}`);
            return { ...p, text: el ? el.value : p.text };
        });
    }

    // Solution
    const concepts = document.getElementById('edit-concepts').value
        .split(',').map(s => s.trim()).filter(Boolean);
    const equations = document.getElementById('edit-equations').value
        .split('\n').map(s => s.trim()).filter(Boolean);
    const steps = document.getElementById('edit-steps').value
        .split('\n').map(s => s.trim()).filter(Boolean);
    const explanation = document.getElementById('edit-explanation').value.trim();
    updates.solution = { ...q.solution, concepts, equations, steps, explanation };

    // Metadata
    updates.topics = document.getElementById('edit-topics').value
        .split(',').map(s => s.trim()).filter(Boolean);
    const diff = parseInt(document.getElementById('edit-difficulty').value);
    if (diff >= 1 && diff <= 5) updates.difficulty = diff;

    const resp = await fetch(`/api/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });

    const status = document.getElementById('save-status');
    if (resp.ok) {
        // Update local state
        Object.assign(currentQuestion, updates);
        status.textContent = 'Saved!';
        status.style.color = '#4caf50';
        // Re-render the question list to reflect text changes
        renderQuestionList();
    } else {
        status.textContent = 'Save failed';
        status.style.color = '#f44';
    }
    setTimeout(() => status.textContent = '', 3000);
}

// ============================================================
// Mode switching
// ============================================================

function setChatMode(mode) {
    chatMode = mode;
    document.getElementById('btn-discuss').classList.toggle('active', mode === 'discuss');
    document.getElementById('btn-visualize').classList.toggle('active', mode === 'visualize');

    const overlay = document.getElementById('viz-overlay');

    if (mode === 'visualize') {
        overlay.style.display = 'flex';
        updateVizScopeUI();
        renderVizChatMessages();
        document.getElementById('viz-chat-input').focus();
    } else {
        overlay.style.display = 'none';
        renderChatMessages();
    }
}

function setVizScope(scope) {
    vizScope = scope;
    // Reset viz chat when switching scope
    vizHistory = [];
    lastVizHTML = '';
    document.getElementById('viz-iframe').style.display = 'none';
    document.getElementById('viz-placeholder').style.display = 'block';
    document.getElementById('viz-actions').style.display = 'none';
    renderVizChatMessages();
    updateVizScopeUI();
}

function updateVizScopeUI() {
    document.getElementById('btn-viz-question').classList.toggle('active', vizScope === 'question');
    document.getElementById('btn-viz-concept').classList.toggle('active', vizScope === 'concept');

    const label = document.getElementById('viz-scope-label');
    const input = document.getElementById('viz-chat-input');
    if (vizScope === 'question' && currentQuestion) {
        label.textContent = currentQuestion.id;
        input.placeholder = `Visualize ${currentQuestion.id}...`;
    } else if (vizScope === 'question') {
        label.textContent = '(no question selected)';
        input.placeholder = 'Select a question first, or switch to Concept mode...';
    } else {
        label.textContent = 'general concept';
        input.placeholder = 'Describe the concept to visualize (e.g., "thin lens ray diagrams")...';
    }
}

// ============================================================
// Chat
// ============================================================

function getActiveHistory() {
    return chatMode === 'visualize' ? vizHistory : discussHistory;
}

function getActiveMsgContainer() {
    return chatMode === 'visualize'
        ? document.getElementById('viz-chat-messages')
        : document.getElementById('chat-messages');
}

function getActiveInput() {
    return chatMode === 'visualize'
        ? document.getElementById('viz-chat-input')
        : document.getElementById('chat-input');
}

function getActiveSendBtn() {
    return chatMode === 'visualize'
        ? document.getElementById('viz-chat-send')
        : document.getElementById('chat-send');
}

async function sendChat() {
    const input = getActiveInput();
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    const history = getActiveHistory();

    // Build context about the current question
    let questionContext = '';
    if (currentQuestion) {
        const q = currentQuestion;
        questionContext = `Current question: ${q.id}\n${q.text}\n`;
        if (q.choices) {
            questionContext += 'Choices:\n';
            for (const [k, v] of Object.entries(q.choices)) {
                questionContext += `  ${k}) ${v}\n`;
            }
            questionContext += `Correct answer: ${q.correct_answer}\n`;
        }
        if (q.solution) {
            questionContext += `Solution:\n${JSON.stringify(q.solution, null, 2)}\n`;
        }
    }

    // Add user message
    history.push({ role: 'user', content: text });
    addBubbleTo(getActiveMsgContainer(), 'user', text);

    // Build system prompt
    let system;
    if (chatMode === 'visualize') {
        system = VIZ_SYSTEM_PROMPT;
        if (vizScope === 'question' && questionContext) {
            system += `\n\nContext — the user is looking at this physics question:\n${questionContext}`;
        } else if (vizScope === 'concept') {
            system += `\n\nThe user wants a general concept-level visualization (not tied to a specific question). Build an interactive demo that teaches the concept with adjustable parameters.`;
        }
        if (lastVizHTML) {
            system += `\n\nThe current visualization HTML that the user wants to iterate on:\n\`\`\`html\n${lastVizHTML}\n\`\`\``;
        }
    } else {
        system = `You are a helpful physics tutor assistant and question editor. Help the user understand, discuss, and fix questions. Use LaTeX for math (delimited by $ or $$).

When the user asks you to fix or edit the question, choices, correct answer, solution, or any other field, include a JSON edit block in your response using this exact format:

\`\`\`edit
{
  "text": "corrected question text (or omit to leave unchanged)",
  "choices": {"a": "...", "b": "...", "c": "...", "d": "..."} (or omit),
  "correct_answer": "a/b/c/d" (or omit),
  "solution": {
    "concepts": ["..."],
    "equations": ["$...$"],
    "steps": ["Step 1: ...", "Step 2: ..."],
    "explanation": "..."
  } (or omit),
  "topics": ["mechanics.kinematics"] (or omit),
  "difficulty": 3 (or omit)
}
\`\`\`

Only include the fields that need to change. Always explain what you're changing and why before or after the edit block.`;
        if (questionContext) {
            system += `\n\nCurrent question data:\n${questionContext}`;
        }
    }

    const sendBtn = getActiveSendBtn();
    const msgContainer = getActiveMsgContainer();
    sendBtn.disabled = true;
    addBubbleTo(msgContainer, 'system', 'Thinking...');

    try {
        const resp = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: history, system }),
        });
        const data = await resp.json();

        // Remove "Thinking..."
        msgContainer.removeChild(msgContainer.lastChild);

        if (data.error) {
            addBubbleTo(msgContainer, 'system', `Error: ${data.error}`);
        } else {
            const reply = data.content;
            history.push({ role: 'assistant', content: reply });

            if (chatMode === 'visualize' && reply.includes('<!DOCTYPE html')) {
                const htmlMatch = reply.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
                if (htmlMatch) {
                    lastVizHTML = htmlMatch[0];
                    renderVisualization(lastVizHTML);
                    addBubbleTo(msgContainer, 'assistant', 'Visualization generated. You can request edits and I\'ll update it.');
                } else {
                    addBubbleTo(msgContainer, 'assistant', reply);
                }
            } else if (chatMode === 'discuss' && reply.includes('```edit')) {
                // Extract edit block and display with Apply button
                const editMatch = reply.match(/```edit\s*([\s\S]*?)```/);
                const textParts = reply.split(/```edit[\s\S]*?```/);
                const explanationText = textParts.join('').trim();

                if (explanationText) {
                    addBubbleTo(msgContainer, 'assistant', explanationText);
                }

                if (editMatch) {
                    try {
                        const edits = JSON.parse(editMatch[1].trim());
                        addEditProposal(msgContainer, edits);
                    } catch (e) {
                        addBubbleTo(msgContainer, 'system', 'Could not parse edit block.');
                    }
                }
            } else {
                addBubbleTo(msgContainer, 'assistant', reply);
            }

            if (data.usage) {
                addBubbleTo(msgContainer, 'system', `Tokens: ${data.usage.input_tokens} in / ${data.usage.output_tokens} out`);
            }
        }
    } catch (err) {
        msgContainer.removeChild(msgContainer.lastChild);
        addBubbleTo(msgContainer, 'system', `Network error: ${err.message}`);
    }

    sendBtn.disabled = false;
}

function addBubbleTo(container, role, text) {
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    if (role === 'assistant') renderMathIn(bubble);
}

function renderChatMessages() {
    const el = document.getElementById('chat-messages');
    el.innerHTML = '';
    discussHistory.forEach(msg => addBubbleTo(el, msg.role, msg.content));
}

function renderVizChatMessages() {
    const el = document.getElementById('viz-chat-messages');
    el.innerHTML = '';
    vizHistory.forEach(msg => addBubbleTo(el, msg.role, msg.content));
}

// ============================================================
// Visualization
// ============================================================

function renderVisualization(html) {
    const iframe = document.getElementById('viz-iframe');
    const placeholder = document.getElementById('viz-placeholder');
    const actions = document.getElementById('viz-actions');
    iframe.style.display = 'block';
    placeholder.style.display = 'none';
    actions.style.display = 'flex';
    iframe.srcdoc = html;
}

function copyVizHTML() {
    if (!lastVizHTML) return;
    navigator.clipboard.writeText(lastVizHTML).then(() => {
        addBubbleTo(document.getElementById('viz-chat-messages'), 'system', 'HTML copied to clipboard.');
    });
}

function promptSaveViz() {
    if (!lastVizHTML) return;

    // Smart default filename
    let defaultName;
    if (vizScope === 'question' && currentQuestion) {
        // e.g. "1994_Q01.html"
        defaultName = currentQuestion.id + '.html';
    } else {
        defaultName = 'concept-.html';
    }

    const name = prompt('Filename:', defaultName);
    if (!name) return;

    const questionId = (vizScope === 'question' && currentQuestion) ? currentQuestion.id : null;

    fetch('/api/save-viz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: name, html: lastVizHTML, question_id: questionId, scope: vizScope }),
    })
    .then(r => r.json())
    .then(data => {
        const container = document.getElementById('viz-chat-messages');
        if (data.ok) {
            addBubbleTo(container, 'system', `Saved to ${data.path}`);
        } else {
            addBubbleTo(container, 'system', `Save failed: ${data.error}`);
        }
    });
}

// ============================================================
// Edit Proposals (AI → Editor)
// ============================================================

let pendingEdits = null;

function addEditProposal(container, edits) {
    pendingEdits = edits;

    const div = document.createElement('div');
    div.className = 'chat-msg assistant';
    const bubble = document.createElement('div');
    bubble.className = 'bubble edit-proposal';

    let preview = '<strong>Proposed edits:</strong><br>';
    if (edits.text) preview += `<div class="edit-preview-field"><span class="edit-label">Text:</span> ${escapeHTML(edits.text.substring(0, 120))}${edits.text.length > 120 ? '...' : ''}</div>`;
    if (edits.choices) {
        preview += '<div class="edit-preview-field"><span class="edit-label">Choices:</span> ';
        for (const [k, v] of Object.entries(edits.choices)) {
            preview += `${k}) ${escapeHTML(v.substring(0, 40))}  `;
        }
        preview += '</div>';
    }
    if (edits.correct_answer) preview += `<div class="edit-preview-field"><span class="edit-label">Answer:</span> ${edits.correct_answer}</div>`;
    if (edits.solution) preview += `<div class="edit-preview-field"><span class="edit-label">Solution:</span> (updated)</div>`;
    if (edits.topics) preview += `<div class="edit-preview-field"><span class="edit-label">Topics:</span> ${edits.topics.join(', ')}</div>`;
    if (edits.difficulty) preview += `<div class="edit-preview-field"><span class="edit-label">Difficulty:</span> ${edits.difficulty}</div>`;

    bubble.innerHTML = preview;

    const btnRow = document.createElement('div');
    btnRow.className = 'edit-proposal-actions';
    btnRow.innerHTML = `<button class="apply-btn" onclick="applyEdits()">Apply Edits</button><button class="dismiss-btn" onclick="dismissEdits(this)">Dismiss</button>`;

    bubble.appendChild(btnRow);
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function applyEdits() {
    if (!pendingEdits || !currentQuestion) return;
    const edits = pendingEdits;

    // Apply to form fields
    if (edits.text) {
        const el = document.getElementById('edit-text');
        if (el) el.value = edits.text;
    }
    if (edits.choices) {
        for (const [letter, text] of Object.entries(edits.choices)) {
            const el = document.getElementById(`edit-choice-${letter}`);
            if (el) el.value = text;
        }
    }
    if (edits.correct_answer) {
        const radio = document.querySelector(`input[name="correct-answer"][value="${edits.correct_answer}"]`);
        if (radio) radio.checked = true;
    }
    if (edits.solution) {
        const sol = edits.solution;
        if (sol.concepts) {
            const el = document.getElementById('edit-concepts');
            if (el) el.value = sol.concepts.join(', ');
        }
        if (sol.equations) {
            const el = document.getElementById('edit-equations');
            if (el) el.value = sol.equations.join('\n');
        }
        if (sol.steps) {
            const el = document.getElementById('edit-steps');
            if (el) el.value = sol.steps.join('\n');
        }
        if (sol.explanation) {
            const el = document.getElementById('edit-explanation');
            if (el) el.value = sol.explanation;
        }
    }
    if (edits.topics) {
        const el = document.getElementById('edit-topics');
        if (el) el.value = edits.topics.join(', ');
    }
    if (edits.difficulty) {
        const el = document.getElementById('edit-difficulty');
        if (el) el.value = edits.difficulty;
    }

    pendingEdits = null;
    addBubbleTo(document.getElementById('chat-messages'), 'system', 'Edits applied to form. Click "Save Changes" to persist.');
}

function dismissEdits(btn) {
    pendingEdits = null;
    const proposal = btn.closest('.chat-msg');
    if (proposal) proposal.remove();
}

// ============================================================
// Utilities
// ============================================================

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function renderMathIn(el) {
    if (typeof renderMathInElement === 'function') {
        renderMathInElement(el, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false },
                { left: '\\[', right: '\\]', display: true },
            ],
            throwOnError: false,
        });
    }
}
