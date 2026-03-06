// Study Bank - Analytics

const MAIN_TOPICS = {
    'mechanics': 'Mechanics',
    'electromagnetism': 'Electromagnetism',
    'waves_optics': 'Waves & Optics',
    'thermodynamics': 'Thermodynamics',
    'modern_physics': 'Modern Physics',
    'fluids': 'Fluids'
};

async function loadData() {
    const res = await fetch('data/questions.json');
    const data = await res.json();
    return data.questions;
}

function renderOverview(questions) {
    const mc = questions.filter(q => q.type === 'multiple_choice').length;
    const fr = questions.filter(q => q.type === 'free_response').length;
    const years = new Set(questions.map(q => q.year));
    const diffs = questions.filter(q => q.difficulty).map(q => q.difficulty);
    const avgDiff = diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1) : '–';

    document.getElementById('overview').innerHTML = `
        <div class="stat-cards">
            <div class="stat-card"><div class="stat-value">${questions.length}</div><div class="stat-label">Total Questions</div></div>
            <div class="stat-card"><div class="stat-value">${years.size}</div><div class="stat-label">Exam Years</div></div>
            <div class="stat-card"><div class="stat-value">${mc} / ${fr}</div><div class="stat-label">MC / Free Response</div></div>
            <div class="stat-card"><div class="stat-value">${avgDiff}</div><div class="stat-label">Avg Difficulty (1-5)</div></div>
        </div>`;
}

function renderBars(containerId, title, items) {
    const max = Math.max(...items.map(i => i.count));
    const bars = items.map(i => `
        <div class="bar-row">
            <span class="bar-label">${i.label}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(i.count / max * 100).toFixed(1)}%"></div></div>
            <span class="bar-count">${i.count}</span>
        </div>`).join('');

    document.getElementById(containerId).innerHTML = `<h2>${title}</h2>${bars}`;
}

function renderTopicBars(questions) {
    const counts = {};
    for (const q of questions) {
        const t = q.topic || 'unknown';
        counts[t] = (counts[t] || 0) + 1;
    }
    const items = Object.entries(MAIN_TOPICS)
        .filter(([k]) => counts[k])
        .map(([k, label]) => ({ label, count: counts[k] }))
        .sort((a, b) => b.count - a.count);

    renderBars('topic-distribution', 'Topic Distribution', items);
}

function renderDifficultyBars(questions) {
    const counts = {};
    for (const q of questions) {
        if (q.difficulty) counts[q.difficulty] = (counts[q.difficulty] || 0) + 1;
    }
    const items = [1, 2, 3, 4, 5]
        .filter(d => counts[d])
        .map(d => ({ label: `Level ${d}`, count: counts[d] }));

    renderBars('difficulty-distribution', 'Difficulty Distribution', items);
}

function renderYearBreakdown(questions) {
    const years = [...new Set(questions.map(q => q.year))].sort((a, b) => a - b);
    let selectedYear = null;

    const container = document.getElementById('year-breakdown');

    function render() {
        const chips = years.map(y =>
            `<button class="chip${y === selectedYear ? ' active' : ''}" data-year="${y}">${y}</button>`
        ).join('');

        let detail = '';
        if (selectedYear) {
            const yq = questions.filter(q => q.year === selectedYear);
            const mc = yq.filter(q => q.type === 'multiple_choice').length;
            const fr = yq.filter(q => q.type === 'free_response').length;
            const diffs = yq.filter(q => q.difficulty).map(q => q.difficulty);
            const avg = diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(1) : '–';

            const topicCounts = {};
            for (const q of yq) {
                const t = q.topic || 'unknown';
                topicCounts[t] = (topicCounts[t] || 0) + 1;
            }
            const maxT = Math.max(...Object.values(topicCounts));
            const topicBars = Object.entries(MAIN_TOPICS)
                .filter(([k]) => topicCounts[k])
                .sort((a, b) => (topicCounts[b[0]] || 0) - (topicCounts[a[0]] || 0))
                .map(([k, label]) => `
                    <div class="bar-row">
                        <span class="bar-label">${label}</span>
                        <div class="bar-track"><div class="bar-fill" style="width:${(topicCounts[k] / maxT * 100).toFixed(1)}%"></div></div>
                        <span class="bar-count">${topicCounts[k]}</span>
                    </div>`).join('');

            detail = `
                <div class="year-detail">
                    <h3>${selectedYear} Exam</h3>
                    <div class="year-stats">
                        <span>${yq.length} questions (${mc} MC, ${fr} FR)</span>
                        <span>Avg difficulty: ${avg}</span>
                    </div>
                    ${topicBars}
                </div>`;
        }

        container.innerHTML = `<h2>Year-by-Year Breakdown</h2>
            <div class="year-chips">${chips}</div>${detail}`;

        container.querySelectorAll('.chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const y = parseInt(btn.dataset.year);
                selectedYear = selectedYear === y ? null : y;
                render();
            });
        });
    }

    render();
}

function renderTrends(questions) {
    const eras = [
        { label: '1994–2000', min: 1994, max: 2000 },
        { label: '2001–2010', min: 2001, max: 2010 },
        { label: '2011–2019', min: 2011, max: 2019 },
        { label: '2022–2025', min: 2022, max: 2025 }
    ];

    const topicKeys = Object.keys(MAIN_TOPICS);

    const eraData = eras.map(era => {
        const eq = questions.filter(q => q.year >= era.min && q.year <= era.max);
        const total = eq.length;
        const counts = {};
        for (const q of eq) counts[q.topic] = (counts[q.topic] || 0) + 1;
        return { label: era.label, total, counts };
    });

    const headerCells = eras.map(e => `<th>${e.label}</th>`).join('');
    const rows = topicKeys.map(tk => {
        const cells = eraData.map(ed => {
            const pct = ed.total ? ((ed.counts[tk] || 0) / ed.total * 100).toFixed(0) : '–';
            return `<td class="num">${pct}%</td>`;
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

(async function init() {
    const questions = await loadData();
    renderOverview(questions);
    renderTopicBars(questions);
    renderDifficultyBars(questions);
    renderYearBreakdown(questions);
    renderTrends(questions);
})();
