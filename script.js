document.addEventListener('DOMContentLoaded', () => {
    const numGrillesSelect = document.getElementById('numGrilles');
    const generateBtn = document.getElementById('generate-btn');
    const btnLoader = document.getElementById('btn-loader');
    const resultsPanel = document.getElementById('results');
    const dateDisplay = document.getElementById('date-display');
    const moonDisplay = document.getElementById('moon-display');
    const insightBox = document.getElementById('insight-box');
    const gridsContainer = document.getElementById('grids-container');

    const tabCalcBtn = document.getElementById('tab-calc-btn');
    const tabHistBtn = document.getElementById('tab-hist-btn');
    const calcView = document.getElementById('calc-view');
    const historyView = document.getElementById('history-view');
    const historyList = document.getElementById('history-list');

    // === MATHS CORE (PORTED FROM PYTHON) ===

    function getMoonPhase(date) {
        // Reference New Moon: Jan 6, 2000
        const refDate = new Date(Date.UTC(2000, 0, 6, 18, 14, 0));
        const synodicMonth = 29.53058867 * 24 * 60 * 60 * 1000;
        const diff = date.getTime() - refDate.getTime();
        let phase = (diff % synodicMonth) / synodicMonth;
        if (phase < 0) phase += 1;
        return phase; // 0 to 1
    }

    function calculatePearson(X, Y) {
        const n = X.length;
        if (n === 0) return 0;
        const meanX = X.reduce((a, b) => a + b) / n;
        const meanY = Y.reduce((a, b) => a + b) / n;
        let num = 0, denX = 0, denY = 0;
        for (let i = 0; i < n; i++) {
            const dx = X[i] - meanX;
            const dy = Y[i] - meanY;
            num += dx * dy;
            denX += dx * dx;
            denY += dy * dy;
        }
        if (denX === 0 || denY === 0) return 0;
        return num / Math.sqrt(denX * denY);
    }

    function generateGrillesStatic(n_grilles) {
        const now = new Date();
        const moonToday = getMoonPhase(now);
        
        // Prepare historical lunar scores (Y)
        const Y = ARCHIVES.map(d => getMoonPhase(new Date(d.date)));
        const meanY = Y.reduce((a, b) => a + b) / Y.length;
        const stdY = Math.sqrt(Y.map(y => Math.pow(y - meanY, 2)).reduce((a, b) => a + b) / Y.length);

        function getAdjustedProbs(possibilities, keys) {
            let sumProbs = 0;
            const results = [];
            for (let num of possibilities) {
                // Vector X: 1 if num in row, else 0
                const X = ARCHIVES.map(row => keys.some(k => row[k] === num) ? 1 : 0);
                const meanX = X.reduce((a, b) => a + b) / X.length;
                const stdX = Math.sqrt(X.map(x => Math.pow(x - meanX, 2)).reduce((a, b) => a + b) / X.length);
                
                const rho = calculatePearson(X, Y);
                // Regression-like adjustment
                let prob = meanX;
                if (stdX > 0 && stdY > 0) {
                    prob += rho * (stdX / stdY) * (moonToday - meanY);
                }
                prob = Math.max(0.0001, prob);
                results.push({ num, prob, freq: meanX, rho });
                sumProbs += prob;
            }
            return results.map(r => ({ ...r, normalized: r.prob / sumProbs }));
        }

        const numProbs = getAdjustedProbs(Array.from({length: 50}, (_, i) => i + 1), ['n1','n2','n3','n4','n5']);
        const starProbs = getAdjustedProbs(Array.from({length: 12}, (_, i) => i + 1), ['e1','e2']);

        // Insights logic
        const delta_y = moonToday - meanY;
        const topAstro = [...numProbs].sort((a,b) => (b.rho * delta_y) - (a.rho * delta_y)).slice(0, 3);
        const topFreq = [...numProbs].sort((a,b) => b.freq - a.freq).slice(0, 3);
        
        let phaseName = "";
        if (moonToday > 0.9) phaseName = "Pleine Lune";
        else if (moonToday < 0.1) phaseName = "Nouvelle Lune";
        else phaseName = `Lune (${Math.round(moonToday*100)}%)`;

        const explanation = `
            <strong>1. Statistiques :</strong> Les numéros ${topFreq.map(x => `${x.num} (${Math.round(x.freq * ARCHIVES.length)} sorties)`).join(', ')} trônent en tête.<br><br>
            <strong>2. Alignement céleste :</strong> Actuellement en phase ${phaseName}, le moteur cible les numéros <strong>${topAstro.map(x => x.num).join(', ')}</strong>.<br><br>
            <strong>3. Poids Lunaire (${moonToday.toFixed(2)}) :</strong> Pivot de corrélation historique utilisé sur les ${ARCHIVES.length} tirages archivés.
        `;

        function weightedRandom(data, count) {
            const picks = [];
            const pool = [...data];
            for (let i = 0; i < count; i++) {
                let r = Math.random();
                let acc = 0;
                for (let j = 0; j < pool.length; j++) {
                    acc += pool[j].normalized;
                    if (r <= acc) {
                        picks.push(pool[j].num);
                        pool.splice(j, 1);
                        // Re-normalize
                        const newSum = pool.reduce((a, b) => a + b.normalized, 0);
                        pool.forEach(p => p.normalized /= newSum);
                        break;
                    }
                }
            }
            return picks.sort((a,b) => a - b);
        }

        const grilles = [];
        for (let i = 0; i < n_grilles; i++) {
            grilles.push({
                nums: weightedRandom(numProbs, 5),
                etoiles: weightedRandom(starProbs, 2)
            });
        }

        return {
            id: Date.now().toString(),
            date: now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
            moon_weight: moonToday.toFixed(2),
            explanation,
            grilles
        };
    }

    // === UI CONTROLLER ===

    tabCalcBtn.addEventListener('click', () => {
        tabCalcBtn.classList.add('active');
        tabHistBtn.classList.remove('active');
        calcView.classList.remove('hidden');
        historyView.classList.add('hidden');
    });

    tabHistBtn.addEventListener('click', () => {
        tabHistBtn.classList.add('active');
        tabCalcBtn.classList.remove('active');
        historyView.classList.remove('hidden');
        calcView.classList.add('hidden');
        loadHistory();
    });

    generateBtn.addEventListener('click', () => {
        generateBtn.disabled = true;
        btnLoader.style.display = 'block';

        setTimeout(() => {
            const data = generateGrillesStatic(parseInt(numGrillesSelect.value));
            
            dateDisplay.textContent = data.date;
            moonDisplay.textContent = data.moon_weight;
            insightBox.innerHTML = `<strong>⭐ Analyse MATHMILLIONS :</strong><br>${data.explanation}`;
            
            gridsContainer.innerHTML = '';
            data.grilles.forEach((grid, i) => {
                const row = document.createElement('div');
                row.className = 'grid-row';
                row.innerHTML = `
                    <span class="grid-id">#${i+1}</span>
                    <div class="numbers">${grid.nums.map(n => `<span class="ball">${n}</span>`).join('')}</div>
                    <span class="plus">+</span>
                    <div class="stars">${grid.etoiles.map(s => `<span class="ball star">${s}</span>`).join('')}</div>
                `;
                gridsContainer.appendChild(row);
            });

            resultsPanel.classList.remove('hidden');
            saveToLocal(data);

            generateBtn.disabled = false;
            btnLoader.style.display = 'none';
        }, 300);
    });

    function saveToLocal(prediction) {
        const logs = JSON.parse(localStorage.getItem('mathmillions_logs') || '[]');
        logs.push(prediction);
        localStorage.setItem('mathmillions_logs', JSON.stringify(logs));
    }

    function loadHistory() {
        const logs = JSON.parse(localStorage.getItem('mathmillions_logs') || '[]');
        historyList.innerHTML = '';

        if (logs.length === 0) {
            historyList.innerHTML = '<p style="text-align:center; opacity:0.6; margin-top:2rem;">Aucune prédiction enregistrée.</p>';
            return;
        }

        logs.slice().reverse().forEach(entry => {
            const item = document.createElement('div');
            item.className = 'history-item';
            
            let statusHtml = entry.score !== undefined ? `<div class="score-badge">Score: ${entry.score} pts</div>` : '';

            item.innerHTML = `
                <div class="hist-header">
                    <span>🗓️ ${entry.date}</span>
                    ${statusHtml}
                </div>
                <div style="font-size:0.85rem; opacity:0.8; margin-bottom:10px;">Lune: ${entry.moon_weight}</div>
                <div style="font-size:0.75rem; color:var(--box-dark); line-height:1.4;">
                    ${entry.grilles.map(g => g.nums.join(',') + ' [' + g.etoiles.join(',') + ']').join('<br>')}
                </div>
            `;
            historyList.appendChild(item);
        });
    }
});
