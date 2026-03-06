// Study Bank - Main Application

let allQuestions = [];
let filteredQuestions = [];
let displayedCount = 0;
const BATCH_SIZE = 20;

// Topic display names - main categories
const MAIN_TOPICS = {
    'mechanics': 'Mechanics',
    'electromagnetism': 'Electromagnetism',
    'waves_optics': 'Waves & Optics',
    'thermodynamics': 'Thermodynamics',
    'modern_physics': 'Modern Physics',
    'fluids': 'Fluids'
};

// Subtopic display names
const SUBTOPIC_NAMES = {
    'kinematics': 'Kinematics',
    'dynamics': 'Dynamics',
    'energy': 'Energy',
    'momentum': 'Momentum',
    'rotation': 'Rotation',
    'shm': 'Simple Harmonic Motion',
    'gravity': 'Gravity',
    'statics': 'Statics',
    'electrostatics': 'Electrostatics',
    'electric_potential': 'Electric Potential',
    'capacitors': 'Capacitors',
    'dc_circuits': 'DC Circuits',
    'ac_circuits': 'AC Circuits',
    'magnetism': 'Magnetism',
    'induction': 'Induction',
    'wave_properties': 'Wave Properties',
    'sound': 'Sound',
    'reflection': 'Reflection',
    'refraction': 'Refraction',
    'lenses': 'Lenses',
    'mirrors': 'Mirrors',
    'interference': 'Interference',
    'diffraction': 'Diffraction',
    'heat': 'Heat',
    'phase_changes': 'Phase Changes',
    'ideal_gas': 'Ideal Gas',
    'first_law': 'First Law',
    'entropy': 'Entropy',
    'relativity': 'Relativity',
    'photoelectric': 'Photoelectric',
    'atomic': 'Atomic',
    'nuclear': 'Nuclear',
    'pressure': 'Pressure',
    'buoyancy': 'Buoyancy',
    'fluid_dynamics': 'Fluid Dynamics'
};

// Subject display names (extensible)
const SUBJECT_NAMES = {
    'physics': 'Physics'
};

// Source display names
const SOURCE_NAMES = {
    'cap': 'CAP Prize Exam'
};

// Years with available PDFs
const AVAILABLE_EXAMS = new Set([1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2022,2023,2024,2025]);

// Filter state
let browseMode = 'topic'; // 'topic' or 'exam'
let selectedSubject = null;
let selectedTopic = null;
let selectedSubtopic = null;
let selectedSource = null;
let selectedYears = new Set();
let selectedDifficulty = null; // null means "All"
let selectedType = null; // null means "All", or "multiple_choice" / "free_response"

// Precomputed counts
let subjectCounts = {};
let mainTopicCounts = {};
let subtopicMap = {};    // { mechanics: { kinematics: 50, ... }, ... }
let sourceCounts = {};
let sourceYears = {};    // { cap: Set([1994, 1995, ...]), ... }

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadQuestions();
    computeCounts();
    setupFilters();
    setupEventListeners();
    applyFilters();
});

async function loadQuestions() {
    try {
        const response = await fetch('data/questions.json');
        const data = await response.json();
        allQuestions = data.questions.filter(q => q.ai_processed || q.question_type === 'free_response');
        console.log(`Loaded ${allQuestions.length} questions`);
    } catch (error) {
        console.error('Failed to load questions:', error);
        document.getElementById('questions').innerHTML =
            '<p style="text-align:center;padding:2rem;">Failed to load questions. Please try again.</p>';
    }
}

function computeCounts() {
    subjectCounts = {};
    mainTopicCounts = {};
    subtopicMap = {};
    sourceCounts = {};
    sourceYears = {};

    allQuestions.forEach(q => {
        // Subjects
        const subj = q.subject || 'unknown';
        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;

        // Topics
        (q.topics || []).forEach(t => {
            if (t && !t.startsWith('N/A') && !t.startsWith('Cannot') && !t.startsWith('unknown')) {
                const clean = t.replace('NEW:', '');
                const parts = clean.split('.');
                const main = parts[0];
                if (MAIN_TOPICS[main]) {
                    mainTopicCounts[main] = (mainTopicCounts[main] || 0) + 1;
                    if (parts[1]) {
                        if (!subtopicMap[main]) subtopicMap[main] = {};
                        subtopicMap[main][parts[1]] = (subtopicMap[main][parts[1]] || 0) + 1;
                    }
                }
            }
        });

        // Sources
        const src = q.source || 'unknown';
        sourceCounts[src] = (sourceCounts[src] || 0) + 1;
        if (!sourceYears[src]) sourceYears[src] = new Set();
        sourceYears[src].add(q.year);
    });
}

function setupFilters() {
    // Browse by buttons
    const browseButtons = document.getElementById('browse-buttons');
    browseButtons.innerHTML = '';
    ['topic', 'exam'].forEach(mode => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (mode === browseMode ? ' active' : '');
        btn.textContent = mode === 'topic' ? 'Topic' : 'Exam';
        btn.dataset.mode = mode;
        btn.addEventListener('click', () => setBrowseMode(mode));
        browseButtons.appendChild(btn);
    });

    // Subject buttons
    buildSubjectButtons();

    // Topic buttons
    buildTopicButtons();

    // Source buttons
    buildSourceButtons();

    // Type buttons
    buildTypeButtons();

    // Difficulty buttons
    buildDifficultyButtons();

    // Show correct rows
    updateRowVisibility();
}

function buildSubjectButtons() {
    const container = document.getElementById('subject-buttons');
    container.innerHTML = '';
    Object.entries(subjectCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([key, count]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (selectedSubject === key ? ' active' : '');
            btn.textContent = `${SUBJECT_NAMES[key] || key} (${count})`;
            btn.dataset.subject = key;
            btn.addEventListener('click', () => toggleSubject(key));
            container.appendChild(btn);
        });
}

function buildTopicButtons() {
    const container = document.getElementById('topic-buttons');
    container.innerHTML = '';
    Object.entries(mainTopicCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([key, count]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (selectedTopic === key ? ' active' : '');
            btn.textContent = `${MAIN_TOPICS[key]} (${count})`;
            btn.dataset.topic = key;
            btn.addEventListener('click', () => toggleTopic(key));
            container.appendChild(btn);
        });
}

function buildSubtopicButtons(mainTopic) {
    const container = document.getElementById('subtopic-buttons');
    container.innerHTML = '';
    const subs = subtopicMap[mainTopic] || {};
    Object.entries(subs)
        .sort((a, b) => b[1] - a[1])
        .forEach(([sub, count]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (selectedSubtopic === sub ? ' active' : '');
            btn.textContent = `${SUBTOPIC_NAMES[sub] || sub} (${count})`;
            btn.dataset.subtopic = sub;
            btn.addEventListener('click', () => toggleSubtopic(sub));
            container.appendChild(btn);
        });
}

function buildSourceButtons() {
    const container = document.getElementById('source-buttons');
    container.innerHTML = '';
    Object.entries(sourceCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([key, count]) => {
            const btn = document.createElement('button');
            btn.className = 'filter-btn' + (selectedSource === key ? ' active' : '');
            btn.textContent = `${SOURCE_NAMES[key] || key} (${count})`;
            btn.dataset.source = key;
            btn.addEventListener('click', () => toggleSource(key));
            container.appendChild(btn);
        });
}

function buildYearButtons(source) {
    const container = document.getElementById('year-buttons');
    container.innerHTML = '';
    const years = [...(sourceYears[source] || [])].sort();
    years.forEach(year => {
        const btn = document.createElement('button');
        btn.className = 'chip' + (selectedYears.has(year) ? ' active' : '');
        btn.textContent = year;
        btn.dataset.year = year;
        btn.addEventListener('click', () => toggleYear(year));
        container.appendChild(btn);
    });
}

function buildTypeButtons() {
    const container = document.getElementById('type-buttons');
    container.innerHTML = '';
    const options = [
        { value: null, label: 'All' },
        { value: 'multiple_choice', label: 'Multiple Choice' },
        { value: 'free_response', label: 'Free Response' }
    ];
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (selectedType === opt.value ? ' active' : '');
        btn.textContent = opt.label;
        btn.addEventListener('click', () => setType(opt.value));
        container.appendChild(btn);
    });
}

function buildDifficultyButtons() {
    const container = document.getElementById('difficulty-buttons');
    container.innerHTML = '';
    const options = [
        { value: null, label: 'All' },
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' }
    ];
    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn' + (selectedDifficulty === opt.value ? ' active' : '');
        btn.textContent = opt.label;
        btn.dataset.difficulty = opt.value === null ? 'all' : opt.value;
        btn.addEventListener('click', () => setDifficulty(opt.value));
        container.appendChild(btn);
    });
}

// --- State transitions ---

function setBrowseMode(mode) {
    browseMode = mode;
    // Reset all child selections
    selectedSubject = null;
    selectedTopic = null;
    selectedSubtopic = null;
    selectedSource = null;
    selectedYears.clear();
    updateBrowseButtons();
    buildSubjectButtons();
    buildTopicButtons();
    buildSourceButtons();
    updateRowVisibility();
    applyFilters();
}

function toggleSubject(subject) {
    if (selectedSubject === subject) {
        selectedSubject = null;
        selectedTopic = null;
        selectedSubtopic = null;
    } else {
        selectedSubject = subject;
        selectedTopic = null;
        selectedSubtopic = null;
    }
    buildSubjectButtons();
    buildTopicButtons();
    updateRowVisibility();
    applyFilters();
}

function toggleTopic(topic) {
    if (selectedTopic === topic) {
        selectedTopic = null;
        selectedSubtopic = null;
    } else {
        selectedTopic = topic;
        selectedSubtopic = null;
    }
    buildTopicButtons();
    if (selectedTopic) {
        buildSubtopicButtons(selectedTopic);
    }
    updateRowVisibility();
    applyFilters();
}

function toggleSubtopic(sub) {
    selectedSubtopic = selectedSubtopic === sub ? null : sub;
    buildSubtopicButtons(selectedTopic);
    applyFilters();
}

function toggleSource(source) {
    if (selectedSource === source) {
        selectedSource = null;
        selectedYears.clear();
    } else {
        selectedSource = source;
        selectedYears.clear();
    }
    buildSourceButtons();
    if (selectedSource) {
        buildYearButtons(selectedSource);
    }
    updateRowVisibility();
    applyFilters();
}

function toggleYear(year) {
    if (selectedYears.has(year)) {
        selectedYears.delete(year);
    } else {
        selectedYears.add(year);
    }
    document.querySelectorAll('#year-buttons .chip').forEach(btn => {
        const y = parseInt(btn.dataset.year);
        btn.classList.toggle('active', selectedYears.has(y));
    });
    applyFilters();
}

function setType(value) {
    selectedType = value;
    buildTypeButtons();
    applyFilters();
}

function setDifficulty(value) {
    selectedDifficulty = value;
    buildDifficultyButtons();
    applyFilters();
}

function updateBrowseButtons() {
    document.querySelectorAll('#browse-buttons .filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === browseMode);
    });
}

function updateRowVisibility() {
    const subjectRow = document.getElementById('subject-row');
    const topicRow = document.getElementById('topic-row');
    const subtopicRow = document.getElementById('subtopic-row');
    const sourceRow = document.getElementById('source-row');
    const yearRow = document.getElementById('year-row');

    if (browseMode === 'topic') {
        // Topic path: Subject → Topic → Subtopic
        subjectRow.style.display = '';
        topicRow.style.display = selectedSubject ? '' : 'none';
        subtopicRow.style.display = selectedTopic ? '' : 'none';
        sourceRow.style.display = 'none';
        yearRow.style.display = 'none';
    } else {
        // Exam path: Source → Year → Topic → Subtopic
        subjectRow.style.display = 'none';
        sourceRow.style.display = '';
        yearRow.style.display = selectedSource ? '' : 'none';
        topicRow.style.display = selectedSource ? '' : 'none';
        subtopicRow.style.display = (selectedSource && selectedTopic) ? '' : 'none';
    }
}

// --- Event listeners ---

function setupEventListeners() {
    document.getElementById('search').addEventListener('input', debounce(applyFilters, 300));
    document.getElementById('sort-by').addEventListener('change', applyFilters);
    document.getElementById('clear-filters').addEventListener('click', clearFilters);
    document.getElementById('load-more-btn').addEventListener('click', loadMore);

    // Modal close
    document.querySelector('.close-btn').addEventListener('click', closeModal);
    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modal')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// --- Filtering ---

function applyFilters() {
    const search = document.getElementById('search').value.toLowerCase();
    const sortBy = document.getElementById('sort-by').value;

    filteredQuestions = allQuestions.filter(q => {
        // Topic browse path
        if (browseMode === 'topic') {
            // Subject filter
            if (selectedSubject && q.subject !== selectedSubject) return false;

            // Topic/subtopic filter
            if (selectedTopic) {
                const qTopics = (q.topics || []).map(t => t.replace('NEW:', ''));
                if (selectedSubtopic) {
                    if (!qTopics.some(t => t === `${selectedTopic}.${selectedSubtopic}`)) return false;
                } else {
                    if (!qTopics.some(t => t.startsWith(selectedTopic))) return false;
                }
            }
        }

        // Exam browse path
        if (browseMode === 'exam') {
            if (selectedSource) {
                if (q.source !== selectedSource) return false;
                if (selectedYears.size > 0 && !selectedYears.has(q.year)) return false;
            }

            // Topic/subtopic filter (also available in exam mode)
            if (selectedTopic) {
                const qTopics = (q.topics || []).map(t => t.replace('NEW:', ''));
                if (selectedSubtopic) {
                    if (!qTopics.some(t => t === `${selectedTopic}.${selectedSubtopic}`)) return false;
                } else {
                    if (!qTopics.some(t => t.startsWith(selectedTopic))) return false;
                }
            }
        }

        // Question type
        if (selectedType !== null) {
            const qType = q.question_type || 'multiple_choice';
            if (qType !== selectedType) return false;
        }

        // Difficulty
        if (selectedDifficulty !== null) {
            const qDiff = q.difficulty || 3;
            if (qDiff !== selectedDifficulty) return false;
        }

        // Search
        if (search) {
            const searchText = `${q.text} ${q.id} ${(q.topics || []).join(' ')}`.toLowerCase();
            if (!searchText.includes(search)) return false;
        }

        return true;
    });

    // Sort
    filteredQuestions.sort((a, b) => {
        switch (sortBy) {
            case 'year-desc': return b.year - a.year || b.number - a.number;
            case 'year-asc': return a.year - b.year || a.number - b.number;
            case 'difficulty-asc': return (a.difficulty || 3) - (b.difficulty || 3);
            case 'difficulty-desc': return (b.difficulty || 3) - (a.difficulty || 3);
            default: return 0;
        }
    });

    document.getElementById('question-count').textContent = filteredQuestions.length;

    displayedCount = 0;
    document.getElementById('questions').innerHTML = '';
    loadMore();
}

function loadMore() {
    const container = document.getElementById('questions');
    const batch = filteredQuestions.slice(displayedCount, displayedCount + BATCH_SIZE);

    batch.forEach(q => {
        container.appendChild(createQuestionCard(q));
    });

    displayedCount += batch.length;

    const loadMoreDiv = document.getElementById('load-more');
    loadMoreDiv.style.display = displayedCount < filteredQuestions.length ? 'block' : 'none';

    renderMathInElement(container, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
        ],
        throwOnError: false
    });
}

function clearFilters() {
    document.getElementById('search').value = '';
    browseMode = 'topic';
    selectedSubject = null;
    selectedTopic = null;
    selectedSubtopic = null;
    selectedSource = null;
    selectedYears.clear();
    selectedType = null;
    selectedDifficulty = null;
    setupFilters();
    applyFilters();
}

// --- Question card & modal ---

function createQuestionCard(q) {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.dataset.id = q.id;

    const firstTopic = (q.topics || [])[0]?.replace('NEW:', '') || '';
    const parts = firstTopic.split('.');
    const mainTopic = parts[0];
    const subTopic = parts[1];
    const topicName = subTopic
        ? `${MAIN_TOPICS[mainTopic] || mainTopic} → ${SUBTOPIC_NAMES[subTopic] || subTopic}`
        : (MAIN_TOPICS[mainTopic] || mainTopic);

    const previewText = q.text?.length > 200 ? q.text.substring(0, 200) + '...' : q.text;

    const isFR = q.question_type === 'free_response';
    const typeTag = isFR ? '<span class="tag type-fr">Free Response</span>' : '';

    card.innerHTML = `
        <div class="question-header">
            <div>
                <div class="question-meta">
                    <span class="question-id">${q.id}</span>
                    ${typeTag}
                    ${topicName ? `<span class="tag topic">${topicName}</span>` : ''}
                    ${q.difficulty ? `<span class="tag difficulty-${q.difficulty}">Difficulty ${q.difficulty}</span>` : ''}
                    ${q.has_diagram ? '<span class="tag">Has Diagram</span>' : ''}
                </div>
                <p class="question-text">${escapeHtml(previewText || 'No text available')}</p>
            </div>
        </div>
    `;

    card.addEventListener('click', () => openQuestionModal(q));
    return card;
}

function openQuestionModal(q) {
    const modal = document.getElementById('modal');
    const body = document.getElementById('modal-body');
    const isFR = q.question_type === 'free_response';

    const topicNames = (q.topics || []).map(t => {
        const clean = t.replace('NEW:', '');
        const parts = clean.split('.');
        const main = parts[0];
        const sub = parts[1];
        if (sub) return `${MAIN_TOPICS[main] || main} → ${SUBTOPIC_NAMES[sub] || sub}`;
        return MAIN_TOPICS[main] || main;
    });

    // Build the question content section based on type
    let questionContent;
    if (isFR) {
        questionContent = `
            <div class="modal-text">${escapeHtml(q.text)}</div>
            ${renderParts(q.parts)}
            ${q.given_data ? `<div class="given-data"><strong>Given:</strong> ${escapeHtml(q.given_data)}</div>` : ''}
        `;
    } else {
        questionContent = `
            <div class="modal-text">${escapeHtml(q.text)}</div>
            ${renderChoices(q.choices)}
        `;
    }

    // Build hint content from solution concepts + equations
    let hintHtml = '';
    if (q.solution) {
        if (q.solution.concepts?.length) {
            hintHtml += `<p><strong>Concepts:</strong> ${q.solution.concepts.join(', ')}</p>`;
        }
        if (q.solution.equations?.length) {
            hintHtml += '<div class="equations"><strong>Key Equations:</strong><br>';
            q.solution.equations.forEach(eq => { hintHtml += `<div>${eq}</div>`; });
            hintHtml += '</div>';
        }
    }
    if (!hintHtml) hintHtml = '<p><em>No hints available</em></p>';

    // Build answer section based on type
    let answerSection;
    if (isFR) {
        answerSection = `
            <div class="modal-actions">
                <button class="action-btn hint-toggle">Hint</button>
                <button class="action-btn solution-toggle">Show Solution</button>
            </div>
            <div class="hint-reveal" style="display:none;">${hintHtml}</div>
        `;
    } else {
        answerSection = `
            <div class="modal-actions">
                <button class="action-btn hint-toggle">Hint</button>
                <button class="action-btn answer-toggle">Show Answer</button>
                <button class="action-btn solution-toggle">Show Solution</button>
            </div>
            <div class="hint-reveal" style="display:none;">${hintHtml}</div>
            <div class="answer-reveal" style="display:none;">
                ${q.correct_answer ? `<p><strong>Answer:</strong> ${q.correct_answer.toUpperCase()}</p>` : '<p><em>No answer available</em></p>'}
            </div>
        `;
    }

    body.innerHTML = `
        <div class="modal-question">
            <div class="modal-meta">
                <span class="question-id">${q.id}</span>
                ${isFR ? '<span class="tag type-fr">Free Response</span>' : ''}
                ${q.difficulty ? `<span class="tag difficulty-${q.difficulty}">Difficulty ${q.difficulty}</span>` : ''}
                ${q.has_diagram ? '<span class="tag">Has Diagram</span>' : ''}
            </div>
            ${topicNames.length ? `<div class="modal-topics">${topicNames.map(t => `<span class="tag topic">${t}</span>`).join(' ')}</div>` : ''}

            <div class="modal-layout">
                <div class="modal-left">
                    ${questionContent}
                    ${answerSection}
                    <div class="pdf-links">
                        ${AVAILABLE_EXAMS.has(q.year) ? `<a href="pdfs/${q.year}_exam.pdf" target="_blank" class="pdf-link">View Original Exam</a>` : ''}
                    </div>
                </div>

                <div class="modal-right">
                    <div class="solution" style="display:none;">
                        <h4>Solution</h4>
                        ${isFR ? renderFRSolution(q.solution) : renderSolution(q.solution)}
                    </div>
                </div>
            </div>
        </div>
    `;

    // MC answer toggle
    const answerToggle = body.querySelector('.answer-toggle');
    if (answerToggle) {
        answerToggle.addEventListener('click', function() {
            const reveal = body.querySelector('.answer-reveal');
            const isVisible = reveal.style.display !== 'none';
            reveal.style.display = isVisible ? 'none' : 'block';
            this.textContent = isVisible ? 'Show Answer' : 'Hide Answer';

            if (!isVisible && q.correct_answer) {
                body.querySelectorAll('.choice').forEach(el => {
                    const letter = el.querySelector('.choice-letter').textContent.charAt(0).toLowerCase();
                    if (letter === q.correct_answer.toLowerCase()) {
                        el.classList.add('correct');
                    }
                });
            } else {
                body.querySelectorAll('.choice').forEach(el => el.classList.remove('correct'));
            }
        });
    }

    // Hint toggle
    body.querySelector('.hint-toggle').addEventListener('click', function() {
        const hint = body.querySelector('.hint-reveal');
        const isVisible = hint.style.display !== 'none';
        hint.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? 'Hint' : 'Hide Hint';

        if (!isVisible) {
            renderMathInElement(hint, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }
    });

    // Solution toggle
    body.querySelector('.solution-toggle').addEventListener('click', function() {
        const solution = body.querySelector('.solution');
        const isVisible = solution.style.display !== 'none';
        solution.style.display = isVisible ? 'none' : 'block';
        this.textContent = isVisible ? 'Show Solution' : 'Hide Solution';

        if (!isVisible) {
            renderMathInElement(solution, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }
    });

    modal.classList.add('active');

    renderMathInElement(body, {
        delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\[', right: '\\]', display: true},
            {left: '\\(', right: '\\)', display: false}
        ],
        throwOnError: false
    });
}

function renderChoices(choices) {
    if (!choices || Object.keys(choices).length === 0) {
        return '<p class="choices"><em>No choices available</em></p>';
    }

    let html = '<div class="choices">';
    Object.entries(choices).forEach(([letter, text]) => {
        html += `
            <div class="choice">
                <span class="choice-letter">${letter.toUpperCase()})</span>
                ${escapeHtml(text)}
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function renderParts(parts) {
    if (!parts || parts.length === 0) return '';

    let html = '<div class="question-parts">';
    parts.forEach(p => {
        html += `
            <div class="question-part">
                <span class="part-label">(${escapeHtml(p.label)})</span>
                ${escapeHtml(p.text)}
            </div>
        `;
    });
    html += '</div>';
    return html;
}

function renderFRSolution(solution) {
    if (!solution) return '<p><em>No solution available</em></p>';

    let html = '';

    if (solution.concepts?.length) {
        html += `<p><strong>Concepts:</strong> ${solution.concepts.join(', ')}</p>`;
    }

    if (solution.equations?.length) {
        html += '<div class="equations"><strong>Key Equations:</strong><br>';
        solution.equations.forEach(eq => {
            html += `<div>${eq}</div>`;
        });
        html += '</div>';
    }

    // Part-by-part solutions
    if (solution.parts?.length) {
        solution.parts.forEach(p => {
            html += `<div class="solution-part">`;
            html += `<h4>Part (${escapeHtml(p.label)})</h4>`;
            if (p.approach) {
                html += `<p><em>${escapeHtml(p.approach)}</em></p>`;
            }
            if (p.steps?.length) {
                html += '<ol class="solution-steps">';
                p.steps.forEach(step => {
                    html += `<li>${escapeHtml(step)}</li>`;
                });
                html += '</ol>';
            }
            if (p.answer) {
                html += `<p><strong>Result:</strong> ${escapeHtml(p.answer)}</p>`;
            }
            html += '</div>';
        });
    }

    if (solution.explanation) {
        html += `<p><strong>Explanation:</strong> ${escapeHtml(solution.explanation)}</p>`;
    }

    return html || '<p><em>No detailed solution available</em></p>';
}

function renderSolution(solution) {
    if (!solution) return '<p><em>No solution available</em></p>';

    let html = '';

    if (solution.concepts?.length) {
        html += `<p><strong>Concepts:</strong> ${solution.concepts.join(', ')}</p>`;
    }

    if (solution.equations?.length) {
        html += '<div class="equations"><strong>Equations:</strong><br>';
        solution.equations.forEach(eq => {
            html += `<div>${eq}</div>`;
        });
        html += '</div>';
    }

    if (solution.steps?.length) {
        html += '<div class="solution-steps"><strong>Steps:</strong><ol>';
        solution.steps.forEach(step => {
            html += `<li>${escapeHtml(step)}</li>`;
        });
        html += '</ol></div>';
    }

    if (solution.explanation) {
        html += `<p><strong>Explanation:</strong> ${escapeHtml(solution.explanation)}</p>`;
    }

    return html || '<p><em>No detailed solution available</em></p>';
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
