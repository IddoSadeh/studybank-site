// Study Bank - Analytics (full rewrite)

// ── Topic maps (duplicated from app.js — no build tools to share) ──

const MAIN_TOPICS = {
    'mechanics': 'Mechanics',
    'electromagnetism': 'Electromagnetism',
    'waves_optics': 'Waves & Optics',
    'thermodynamics': 'Thermodynamics',
    'modern_physics': 'Modern Physics',
    'fluids': 'Fluids'
};

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

const SOURCE_NAMES = { 'cap': 'CAP' };

const ERAS = [
    { label: '1994\u20132000', min: 1994, max: 2000 },
    { label: '2001\u20132010', min: 2001, max: 2010 },
    { label: '2011\u20132019', min: 2011, max: 2019 },
    { label: '2022\u20132025', min: 2022, max: 2025 }
];

// ── Helpers ──

function getMainTopics(q) {
    const s = new Set();
    for (const t of (q.topics || [])) {
        const main = t.replace('NEW:', '').split('.')[0];
        if (MAIN_TOPICS[main]) s.add(main);
    }
    return s;
}

function getSubtopics(q) {
    const out = [];
    for (const t of (q.topics || [])) {
        const parts = t.replace('NEW:', '').split('.');
        if (parts.length === 2 && MAIN_TOPICS[parts[0]]) {
            out.push({ main: parts[0], sub: parts[1] });
        }
    }
    return out;
}

function diffColor(val) {
    // smooth green → yellow → red gradient for difficulty 1-5
    const t = Math.max(0, Math.min(1, (val - 1) / 4));
    let r, g, b;
    if (t < 0.5) {
        // green → yellow
        const s = t * 2;
        r = Math.round(76 + s * 179);   // 76→255
        g = Math.round(175 + s * 18);   // 175→193
        b = Math.round(80 - s * 73);    // 80→7
    } else {
        // yellow → red
        const s = (t - 0.5) * 2;
        r = Math.round(255 - s * 11);   // 255→244
        g = Math.round(193 - s * 125);  // 193→68
        b = Math.round(7 + s * 47);     // 7→54
    }
    return `rgb(${r}, ${g}, ${b})`;
}

function heatBg(pct) {
    // blue intensity proportional to %
    const alpha = Math.min(pct / 40, 1) * 0.35;
    return `rgba(0, 102, 204, ${alpha.toFixed(2)})`;
}

function diffHeatBg(val) {
    // green→red background for difficulty values
    if (!val || val === '–') return '';
    const v = parseFloat(val);
    const t = (v - 1) / 4; // 0 to 1
    const r = Math.round(76 + t * 168);  // 76→244
    const g = Math.round(175 - t * 107); // 175→68
    const b = Math.round(80 - t * 26);   // 80→54
    return `rgba(${r}, ${g}, ${b}, 0.18)`;
}

// ── State ──

let allQuestions = [];
let selectedSource = 'cap'; // active source filter

function getFilteredQuestions() {
    return allQuestions.filter(q => q.source === selectedSource);
}

// ── Data loading ──

async function loadData() {
    const res = await fetch('data/questions.json');
    const data = await res.json();
    return data.questions;
}

// ── Render functions ──

function renderSourceFilter(questions) {
    const sourceCounts = {};
    for (const q of questions) {
        const s = q.source || 'unknown';
        sourceCounts[s] = (sourceCounts[s] || 0) + 1;
    }
    const sources = Object.keys(sourceCounts).sort();

    const chips = [];
    for (const s of sources) {
        const label = SOURCE_NAMES[s] || s;
        const active = selectedSource === s ? ' active' : '';
        chips.push(`<button class="chip${active}" data-source="${s}">${label} (${sourceCounts[s]})</button>`);
    }

    const el = document.getElementById('source-filter');
    el.innerHTML = `<div class="source-chips">${chips.join('')}</div>`;
    el.querySelectorAll('.chip').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedSource = btn.dataset.source;
            renderAll();
        });
    });
}

function renderOverview(questions) {
    const mc = questions.filter(q => q.question_type === 'multiple_choice').length;
    const fr = questions.filter(q => q.question_type === 'free_response').length;
    const years = new Set(questions.map(q => q.year));
    const diffs = questions.filter(q => q.difficulty).map(q => q.difficulty);
    const avgDiff = diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1) : '\u2013';
    const diagrams = questions.filter(q => q.has_diagram).length;
    const subtopicSet = new Set();
    for (const q of questions) {
        for (const st of getSubtopics(q)) subtopicSet.add(st.main + '.' + st.sub);
    }

    document.getElementById('overview').innerHTML = `
        <div class="stat-cards">
            <div class="stat-card"><div class="stat-value">${questions.length}</div><div class="stat-label">Total Questions</div></div>
            <div class="stat-card"><div class="stat-value">${years.size}</div><div class="stat-label">Exam Years</div></div>
            <div class="stat-card"><div class="stat-value">${mc} / ${fr}</div><div class="stat-label">MC / Free Response</div></div>
            <div class="stat-card"><div class="stat-value">${avgDiff}</div><div class="stat-label">Avg Difficulty (1\u20135)</div></div>
            <div class="stat-card"><div class="stat-value">${diagrams}</div><div class="stat-label">Diagram Questions</div></div>
            <div class="stat-card"><div class="stat-value">${subtopicSet.size}</div><div class="stat-label">Subtopics Covered</div></div>
        </div>`;
}

function renderTopicDistribution(questions) {
    // Count by main topic
    const mainCounts = {};
    const subCounts = {}; // { main: { sub: count } }
    for (const q of questions) {
        const mains = getMainTopics(q);
        for (const m of mains) {
            mainCounts[m] = (mainCounts[m] || 0) + 1;
        }
        for (const { main, sub } of getSubtopics(q)) {
            if (!subCounts[main]) subCounts[main] = {};
            subCounts[main][sub] = (subCounts[main][sub] || 0) + 1;
        }
    }

    const sorted = Object.entries(MAIN_TOPICS)
        .filter(([k]) => mainCounts[k])
        .map(([k, label]) => ({ key: k, label, count: mainCounts[k] }))
        .sort((a, b) => b.count - a.count);

    const max = Math.max(...sorted.map(s => s.count), 1);

    const container = document.getElementById('topic-distribution');
    let expandedTopic = null;

    function render() {
        let html = '<h2>Topic Distribution</h2>';
        for (const item of sorted) {
            const isExpanded = expandedTopic === item.key;
            html += `
                <div class="bar-row clickable-bar" data-topic="${item.key}">
                    <span class="bar-label">${isExpanded ? '\u25BC' : '\u25B6'} ${item.label}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${(item.count / max * 100).toFixed(1)}%"></div></div>
                    <span class="bar-count">${item.count}</span>
                </div>`;
            if (isExpanded && subCounts[item.key]) {
                const subs = Object.entries(subCounts[item.key])
                    .sort((a, b) => b[1] - a[1]);
                const subMax = Math.max(...subs.map(s => s[1]), 1);
                for (const [sub, count] of subs) {
                    const subLabel = SUBTOPIC_NAMES[sub] || sub;
                    html += `
                        <div class="bar-row sub-bar">
                            <span class="bar-label">${subLabel}</span>
                            <div class="bar-track"><div class="bar-fill bar-fill-sub" style="width:${(count / subMax * 100).toFixed(1)}%"></div></div>
                            <span class="bar-count">${count}</span>
                        </div>`;
                }
            }
        }
        container.innerHTML = html;
        container.querySelectorAll('.clickable-bar').forEach(row => {
            row.addEventListener('click', () => {
                const t = row.dataset.topic;
                expandedTopic = expandedTopic === t ? null : t;
                render();
            });
        });
    }
    render();
}

function renderDifficultyDistribution(questions) {
    const mcCounts = {};
    const frCounts = {};
    for (const q of questions) {
        if (!q.difficulty) continue;
        if (q.question_type === 'multiple_choice') {
            mcCounts[q.difficulty] = (mcCounts[q.difficulty] || 0) + 1;
        } else {
            frCounts[q.difficulty] = (frCounts[q.difficulty] || 0) + 1;
        }
    }

    const maxCount = Math.max(
        ...([1,2,3,4,5].map(d => (mcCounts[d] || 0) + (frCounts[d] || 0))),
        1
    );

    let bars = '';
    for (let d = 1; d <= 5; d++) {
        const mc = mcCounts[d] || 0;
        const fr = frCounts[d] || 0;
        const total = mc + fr;
        const mcW = (mc / maxCount * 100).toFixed(1);
        const frW = (fr / maxCount * 100).toFixed(1);
        bars += `
            <div class="bar-row">
                <span class="bar-label">Level ${d}</span>
                <div class="bar-track">
                    <div class="bar-fill bar-fill-mc" style="width:${mcW}%"></div>
                    <div class="bar-fill bar-fill-fr" style="width:${frW}%; left:${mcW}%"></div>
                </div>
                <span class="bar-count">${total}</span>
            </div>`;
    }

    document.getElementById('difficulty-distribution').innerHTML = `
        <h2>Difficulty Distribution</h2>
        <div class="legend">
            <span class="legend-item"><span class="legend-swatch" style="background:#0066cc"></span> MC</span>
            <span class="legend-item"><span class="legend-swatch" style="background:#7b2d8b"></span> FR</span>
        </div>
        ${bars}`;
}

function renderYearBreakdown(questions) {
    const yearMap = {};
    for (const q of questions) {
        if (!yearMap[q.year]) yearMap[q.year] = [];
        yearMap[q.year].push(q);
    }
    const years = Object.keys(yearMap).map(Number).sort((a, b) => a - b);
    let selectedYear = null;
    const container = document.getElementById('year-breakdown');

    function render() {
        // Mini timeline
        const maxYearCount = Math.max(...years.map(y => yearMap[y].length), 1);
        const timeline = years.map(y => {
            const qs = yearMap[y];
            const diffs = qs.filter(q => q.difficulty).map(q => q.difficulty);
            const avg = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 3;
            const h = Math.max(8, (qs.length / maxYearCount) * 50);
            const bg = diffColor(avg);
            const active = y === selectedYear ? 'timeline-block-active' : '';
            return `<div class="timeline-block ${active}" data-year="${y}" style="height:${h}px;background:${bg}" title="${y}: ${qs.length} questions, avg diff ${avg.toFixed(1)}"></div>`;
        }).join('');

        // Year chips
        const chips = years.map(y =>
            `<button class="chip${y === selectedYear ? ' active' : ''}" data-year="${y}">${y}</button>`
        ).join('');

        let detail = '';
        if (selectedYear && yearMap[selectedYear]) {
            const yq = yearMap[selectedYear];
            const mc = yq.filter(q => q.question_type === 'multiple_choice').length;
            const fr = yq.filter(q => q.question_type === 'free_response').length;
            const diffs = yq.filter(q => q.difficulty).map(q => q.difficulty);
            const avg = diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1) : '\u2013';

            // Topic bars for this year
            const topicCounts = {};
            for (const q of yq) {
                for (const m of getMainTopics(q)) {
                    topicCounts[m] = (topicCounts[m] || 0) + 1;
                }
            }
            const maxT = Math.max(...Object.values(topicCounts), 1);
            const topicBars = Object.entries(MAIN_TOPICS)
                .filter(([k]) => topicCounts[k])
                .sort((a, b) => (topicCounts[b[0]] || 0) - (topicCounts[a[0]] || 0))
                .map(([k, label]) => `
                    <div class="bar-row">
                        <span class="bar-label">${label}</span>
                        <div class="bar-track"><div class="bar-fill" style="width:${(topicCounts[k] / maxT * 100).toFixed(1)}%"></div></div>
                        <span class="bar-count">${topicCounts[k]}</span>
                    </div>`).join('');

            // Answer distribution (MC only)
            const mcQs = yq.filter(q => q.question_type === 'multiple_choice');
            let answerDist = '';
            if (mcQs.length) {
                const ansCounts = { a: 0, b: 0, c: 0, d: 0, e: 0 };
                let unknown = 0;
                for (const q of mcQs) {
                    const a = (q.correct_answer || '').toLowerCase().trim();
                    if (ansCounts.hasOwnProperty(a)) ansCounts[a]++;
                    else unknown++;
                }
                const allEntries = Object.entries(ansCounts);
                if (unknown > 0) allEntries.push(['unknown', unknown]);
                const maxA = Math.max(...allEntries.map(e => e[1]), 1);
                answerDist = `<h4>Answer Distribution (${mcQs.length} MC)</h4>` +
                    allEntries.map(([letter, count]) =>
                        `<div class="bar-row">
                            <span class="bar-label">${letter === 'unknown' ? '?' : letter.toUpperCase()}</span>
                            <div class="bar-track"><div class="bar-fill${letter === 'unknown' ? ' bar-fill-unknown' : ''}" style="width:${(count / maxA * 100).toFixed(1)}%"></div></div>
                            <span class="bar-count">${count}</span>
                        </div>`
                    ).join('');
            }

            // Difficulty breakdown
            const diffCounts = {};
            for (const q of yq) {
                if (q.difficulty) diffCounts[q.difficulty] = (diffCounts[q.difficulty] || 0) + 1;
            }
            const maxD = Math.max(...Object.values(diffCounts), 1);
            const diffBars = [1,2,3,4,5].filter(d => diffCounts[d]).map(d =>
                `<div class="bar-row">
                    <span class="bar-label">Level ${d}</span>
                    <div class="bar-track"><div class="bar-fill" style="width:${(diffCounts[d] / maxD * 100).toFixed(1)}%"></div></div>
                    <span class="bar-count">${diffCounts[d]}</span>
                </div>`
            ).join('');

            detail = `
                <div class="year-detail">
                    <h3>${selectedYear} Exam</h3>
                    <div class="year-stats">
                        <span>${yq.length} questions (${mc} MC, ${fr} FR)</span>
                        <span>Avg difficulty: ${avg}</span>
                    </div>
                    ${topicBars}
                    <div style="margin-top:1rem">${answerDist}</div>
                    <div style="margin-top:1rem"><h4>Difficulty Breakdown</h4>${diffBars}</div>
                </div>`;
        }

        container.innerHTML = `<h2>Year-by-Year Breakdown</h2>
            <div class="year-timeline">${timeline}</div>
            <div class="year-chips">${chips}</div>${detail}`;

        container.querySelectorAll('.chip, .timeline-block').forEach(btn => {
            btn.addEventListener('click', () => {
                const y = parseInt(btn.dataset.year);
                selectedYear = selectedYear === y ? null : y;
                render();
            });
        });
    }
    render();
}

function renderTopicTrends(questions) {
    const topicKeys = Object.keys(MAIN_TOPICS);

    const eraData = ERAS.map(era => {
        const eq = questions.filter(q => q.year >= era.min && q.year <= era.max);
        const total = eq.length;
        const counts = {};
        for (const q of eq) {
            for (const m of getMainTopics(q)) {
                counts[m] = (counts[m] || 0) + 1;
            }
        }
        return { label: era.label, total, counts };
    });

    const headerCells = ERAS.map(e => `<th>${e.label}</th>`).join('');
    const rows = topicKeys.map(tk => {
        const cells = eraData.map(ed => {
            const pct = ed.total ? ((ed.counts[tk] || 0) / ed.total * 100) : 0;
            const display = ed.total ? pct.toFixed(0) + '%' : '\u2013';
            return `<td class="num" style="background:${heatBg(pct)}">${display}</td>`;
        }).join('');
        return `<tr><td>${MAIN_TOPICS[tk]}</td>${cells}</tr>`;
    }).join('');

    document.getElementById('topic-trends').innerHTML = `
        <h2>Topic Trends Over Time</h2>
        <table class="trend-table">
            <thead><tr><th>Topic</th>${headerCells}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

function renderStudyPriority(questions) {
    // Build subtopic stats
    const subtopicStats = {};
    for (const q of questions) {
        for (const { main, sub } of getSubtopics(q)) {
            const key = main + '.' + sub;
            if (!subtopicStats[key]) {
                subtopicStats[key] = { main, sub, count: 0, diffs: [], recentCount: 0, earlyCount: 0 };
            }
            const st = subtopicStats[key];
            st.count++;
            if (q.difficulty) st.diffs.push(q.difficulty);
            if (q.year >= 2016) st.recentCount++;
            if (q.year <= 2010) st.earlyCount++;
        }
    }

    const rows = Object.values(subtopicStats).map(st => {
        const avgDiff = st.diffs.length ? (st.diffs.reduce((a, b) => a + b, 0) / st.diffs.length) : null;
        const recentRate = st.recentCount / Math.max(st.count, 1);
        const earlyRate = st.earlyCount / Math.max(st.count, 1);
        let trend, trendClass;
        if (recentRate > earlyRate + 0.15) { trend = '\u2191'; trendClass = 'trend-up'; }
        else if (earlyRate > recentRate + 0.15) { trend = '\u2193'; trendClass = 'trend-down'; }
        else { trend = '\u2192'; trendClass = 'trend-flat'; }

        let priority, priorityClass;
        if (st.count >= 15 && avgDiff && avgDiff >= 3 && trendClass === 'trend-up') {
            priority = 'High'; priorityClass = 'priority-high';
        } else if (st.count >= 15 && avgDiff && avgDiff < 3) {
            priority = 'Quick Win'; priorityClass = 'priority-quick';
        } else if (st.count < 8) {
            priority = 'Low'; priorityClass = 'priority-low';
        } else {
            priority = 'Medium'; priorityClass = 'priority-medium';
        }

        return {
            label: SUBTOPIC_NAMES[st.sub] || st.sub,
            mainLabel: MAIN_TOPICS[st.main] || st.main,
            count: st.count,
            avgDiff,
            trend, trendClass,
            priority, priorityClass
        };
    });

    let sortCol = 'count';
    let sortAsc = false;

    const container = document.getElementById('study-priority');

    function render() {
        const sorted = [...rows].sort((a, b) => {
            let va = a[sortCol], vb = b[sortCol];
            if (sortCol === 'avgDiff') { va = va || 0; vb = vb || 0; }
            if (sortCol === 'label' || sortCol === 'priority') {
                return sortAsc ? (va || '').localeCompare(vb || '') : (vb || '').localeCompare(va || '');
            }
            return sortAsc ? va - vb : vb - va;
        });

        const arrow = col => col === sortCol ? (sortAsc ? ' \u25B2' : ' \u25BC') : '';

        const tableRows = sorted.map(r => {
            const diffDisplay = r.avgDiff ? r.avgDiff.toFixed(1) : '\u2013';
            return `<tr class="${r.priorityClass}">
                <td>${r.label}</td>
                <td class="num">${r.mainLabel}</td>
                <td class="num">${r.count}</td>
                <td class="num">${diffDisplay}</td>
                <td class="num ${r.trendClass}">${r.trend}</td>
                <td>${r.priority}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <h2>Study Priority Matrix</h2>
            <table class="trend-table sortable-table">
                <thead><tr>
                    <th class="sortable" data-col="label">Subtopic${arrow('label')}</th>
                    <th class="sortable" data-col="mainLabel">Topic${arrow('mainLabel')}</th>
                    <th class="sortable" data-col="count">Count${arrow('count')}</th>
                    <th class="sortable" data-col="avgDiff">Avg Diff${arrow('avgDiff')}</th>
                    <th>Trend</th>
                    <th class="sortable" data-col="priority">Priority${arrow('priority')}</th>
                </tr></thead>
                <tbody>${tableRows}</tbody>
            </table>`;

        container.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) sortAsc = !sortAsc;
                else { sortCol = col; sortAsc = false; }
                render();
            });
        });
    }
    render();
}

function renderAnswerPatterns(questions) {
    const mcQs = questions.filter(q => q.question_type === 'multiple_choice');
    const ansCounts = { a: 0, b: 0, c: 0, d: 0, e: 0 };
    let unknown = 0;
    for (const q of mcQs) {
        const a = (q.correct_answer || '').toLowerCase().trim();
        if (ansCounts.hasOwnProperty(a)) ansCounts[a]++;
        else unknown++;
    }

    const resolved = Object.values(ansCounts).reduce((a, b) => a + b, 0);
    const allEntries = Object.entries(ansCounts);
    if (unknown > 0) allEntries.push(['unknown', unknown]);
    const max = Math.max(...allEntries.map(e => e[1]), 1);

    const bars = allEntries.map(([letter, count]) => {
        const pct = (count / mcQs.length * 100).toFixed(1);
        return `<div class="bar-row">
            <span class="bar-label">${letter === 'unknown' ? '?' : letter.toUpperCase()}</span>
            <div class="bar-track"><div class="bar-fill${letter === 'unknown' ? ' bar-fill-unknown' : ''}" style="width:${(count / max * 100).toFixed(1)}%"></div></div>
            <span class="bar-count">${count} (${pct}%)</span>
        </div>`;
    }).join('');

    document.getElementById('answer-patterns').innerHTML = `
        <h2>Answer Pattern Analysis</h2>
        <p class="section-note">Distribution of correct answers across ${mcQs.length} MC questions (${resolved} resolved, ${unknown} undetermined)</p>
        ${bars}`;
}

function renderDifficultyTrends(questions) {
    const eraData = ERAS.map(era => {
        const eq = questions.filter(q => q.year >= era.min && q.year <= era.max);
        const mcDiffs = eq.filter(q => q.question_type === 'multiple_choice' && q.difficulty).map(q => q.difficulty);
        const frDiffs = eq.filter(q => q.question_type === 'free_response' && q.difficulty).map(q => q.difficulty);
        const allDiffs = eq.filter(q => q.difficulty).map(q => q.difficulty);
        const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : '\u2013';
        return { label: era.label, mc: avg(mcDiffs), fr: avg(frDiffs), overall: avg(allDiffs) };
    });

    const headerCells = ERAS.map(e => `<th>${e.label}</th>`).join('');
    const makeRow = (label, key) => {
        const cells = eraData.map(ed => {
            const val = ed[key];
            return `<td class="num" style="background:${diffHeatBg(val)}">${val}</td>`;
        }).join('');
        return `<tr><td>${label}</td>${cells}</tr>`;
    };

    document.getElementById('difficulty-trends').innerHTML = `
        <h2>Difficulty Trends</h2>
        <table class="trend-table">
            <thead><tr><th>Type</th>${headerCells}</tr></thead>
            <tbody>
                ${makeRow('Overall', 'overall')}
                ${makeRow('MC', 'mc')}
                ${makeRow('FR', 'fr')}
            </tbody>
        </table>`;
}

// ── Main ──

function renderAll() {
    const questions = getFilteredQuestions();
    renderSourceFilter(allQuestions); // always show all sources
    renderOverview(questions);
    renderTopicDistribution(questions);
    renderDifficultyDistribution(questions);
    renderYearBreakdown(questions);
    renderTopicTrends(questions);
    renderStudyPriority(questions);
    renderAnswerPatterns(questions);
    renderDifficultyTrends(questions);
}

(async function init() {
    allQuestions = await loadData();
    renderAll();
})();
