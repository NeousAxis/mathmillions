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
    const tabSigBtn = document.getElementById('tab-sig-btn');
    
    const calcView = document.getElementById('calc-view');
    const historyView = document.getElementById('history-view');
    const signatureView = document.getElementById('signature-view');
    
    const historyList = document.getElementById('history-list');
    const sigNumSelect = document.getElementById('sig-num-select');
    const sigReport = document.getElementById('sig-report');
    const sigChart = document.getElementById('sig-chart');

    // Populate Number Selector for Signature
    for (let i = 1; i <= 50; i++) {
        const opt = document.createElement('option');
        opt.value = i; opt.textContent = i;
        sigNumSelect.appendChild(opt);
    }

    const PLANET_KEYS = ['pos_sun', 'pos_moon', 'pos_merc', 'pos_ven', 'pos_mars', 'pos_jup', 'pos_sat'];
    const ZODIAC = ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge", "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"];

    function getSign(lon) {
        return ZODIAC[Math.floor((lon % 360) / 30)];
    }

    // === ASTRO CORE ===

    function getCurrentSkyChart() {
        if (typeof Astronomy === 'undefined') return null;
        const time = new Astronomy.AstroTime(new Date());
        const bodies = {
            'sun': Astronomy.Body.Sun,
            'moon': Astronomy.Body.Moon,
            'merc': Astronomy.Body.Mercury,
            'ven': Astronomy.Body.Venus,
            'mars': Astronomy.Body.Mars,
            'jup': Astronomy.Body.Jupiter,
            'sat': Astronomy.Body.Saturn
        };
        const chart = {};
        for (let [name, body] of Object.entries(bodies)) {
            const equ = Astronomy.Equator(body, time, Astronomy.Observer.Empty, true, true);
            const ecl = Astronomy.Ecliptic(equ);
            chart[`pos_${name}`] = ecl.lon;
        }
        chart.moon_illum = Astronomy.Illumination(Astronomy.Body.Moon, time).phase;
        return chart;
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
        const currentChart = getCurrentSkyChart();
        if (!currentChart) return { error: "Moteur astronomique en cours de chargement..." };

        const planetStats = {};
        PLANET_KEYS.forEach(k => {
            const Y = ARCHIVES.map(d => d[k]);
            const meanY = Y.reduce((a, b) => a + b) / Y.length;
            const stdY = Math.sqrt(Y.map(y => Math.pow(y - meanY, 2)).reduce((a, b) => a + b) / Y.length);
            planetStats[k] = { mean: meanY, std: stdY, values: Y };
        });

        function getAdjustedProbs(possibilities, colKeys) {
            let sumTotalProbs = 0;
            const results = [];
            for (let num of possibilities) {
                const X = ARCHIVES.map(row => colKeys.some(k => row[k] === num) ? 1 : 0);
                const meanX = X.reduce((a, b) => a + b) / X.length;
                const stdX = Math.sqrt(X.map(x => Math.pow(x - meanX, 2)).reduce((a, b) => a + b) / X.length);
                
                let multiAstroWeight = 0;
                let topInfluence = { name: '', rho: 0 };

                PLANET_KEYS.forEach(pk => {
                    const rho = calculatePearson(X, planetStats[pk].values);
                    if (Math.abs(rho) > Math.abs(topInfluence.rho)) topInfluence = { name: pk.replace('pos_',''), rho };
                    if (stdX > 0 && planetStats[pk].std > 0) {
                        multiAstroWeight += rho * (stdX / planetStats[pk].std) * (currentChart[pk] - planetStats[pk].mean);
                    }
                });

                let prob = Math.max(0.0001, meanX + multiAstroWeight);
                results.push({ num, prob, freq: meanX, topInfluence });
                sumTotalProbs += prob;
            }
            return results.map(r => ({ ...r, normalized: r.prob / sumTotalProbs }));
        }

        const numProbs = getAdjustedProbs(Array.from({length: 50}, (_, i) => i + 1), ['n1','n2','n3','n4','n5']);
        const starProbs = getAdjustedProbs(Array.from({length: 12}, (_, i) => i + 1), ['e1','e2']);

        const topAstro = [...numProbs].sort((a,b) => b.prob - a.prob).slice(0, 3);
        
        const explanation = `
            <strong>Alignement Céleste :</strong> Le ciel actuel résonne fortement avec les signatures de sortie des numéros <strong>${topAstro.map(x => x.num).join(', ')}</strong>.<br><br>
            <strong>Facteur Clé :</strong> Le numéro ${topAstro[0].num} bénéficie d'une corrélation de Pearson de ${topAstro[0].topInfluence.rho.toFixed(3)} avec le cycle de ${topAstro[0].topInfluence.name.toUpperCase()}.
        `;

        function weightedRandom(data, count) {
            const picks = [];
            const pool = [...data];
            for (let i = 0; i < count; i++) {
                let r = Math.random(), acc = 0;
                for (let j = 0; j < pool.length; j++) {
                    acc += pool[j].normalized;
                    if (r <= acc) {
                        picks.push(pool[j].num);
                        pool.splice(j, 1);
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
            grilles.push({ nums: weightedRandom(numProbs, 5), etoiles: weightedRandom(starProbs, 2) });
        }

        return {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
            moon_weight: currentChart.moon_illum.toFixed(2),
            explanation,
            grilles
        };
    }

    // === SIGNATURE ANALYSIS ===

    function updateSignature(num) {
        num = parseInt(num);
        const winningDraws = ARCHIVES.filter(row => ['n1','n2','n3','n4','n5'].some(k => row[k] === num));
        const totalWins = winningDraws.length;

        if (totalWins === 0) {
            sigReport.textContent = "Aucun historique pour ce numéro.";
            sigChart.innerHTML = "";
            return;
        }

        let report = `Le numéro <strong>${num}</strong> est sorti <strong>${totalWins} fois</strong> depuis 2004.<br>Voici sa signature céleste moyenne lors de ses victoires :`;
        sigReport.innerHTML = report;

        sigChart.innerHTML = "";
        PLANET_KEYS.forEach(pk => {
            const positions = winningDraws.map(d => d[pk]);
            const avgPos = positions.reduce((a, b) => a + b) / totalWins;
            const sign = getSign(avgPos);
            
            const row = document.createElement('div');
            row.className = 'sig-row';
            row.innerHTML = `
                <span class="sig-planet">${pk.replace('pos_','')}</span>
                <span class="sig-pos">${Math.round(avgPos)}° (${sign})</span>
                <div class="sig-bar-container">
                    <div class="sig-bar" style="width: ${(avgPos/360)*100}%"></div>
                </div>
            `;
            sigChart.appendChild(row);
        });
    }

    // === UI CONTROLLER ===

    function switchTab(tab) {
        [tabCalcBtn, tabHistBtn, tabSigBtn].forEach(b => b.classList.remove('active'));
        [calcView, historyView, signatureView].forEach(v => v.classList.add('hidden'));
        
        if (tab === 'calc') { tabCalcBtn.classList.add('active'); calcView.classList.remove('hidden'); }
        if (tab === 'hist') { tabHistBtn.classList.add('active'); historyView.classList.remove('hidden'); loadHistory(); }
        if (tab === 'sig') { tabSigBtn.classList.add('active'); signatureView.classList.remove('hidden'); updateSignature(sigNumSelect.value); }
    }

    tabCalcBtn.addEventListener('click', () => switchTab('calc'));
    tabHistBtn.addEventListener('click', () => switchTab('hist'));
    tabSigBtn.addEventListener('click', () => switchTab('sig'));
    sigNumSelect.addEventListener('change', () => updateSignature(sigNumSelect.value));

    generateBtn.addEventListener('click', () => {
        generateBtn.disabled = true; btnLoader.style.display = 'block';
        setTimeout(() => {
            const data = generateGrillesStatic(parseInt(numGrillesSelect.value));
            if (data.error) { alert(data.error); return; }
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
            generateBtn.disabled = false; btnLoader.style.display = 'none';
        }, 500);
    });

    function saveToLocal(prediction) {
        const logs = JSON.parse(localStorage.getItem('mathmillions_logs') || '[]');
        logs.push(prediction);
        localStorage.setItem('mathmillions_logs', JSON.stringify(logs));
    }

    function loadHistory() {
        const logs = JSON.parse(localStorage.getItem('mathmillions_logs') || '[]');
        historyList.innerHTML = logs.length === 0 ? '<p style="text-align:center; opacity:0.6; margin-top:2rem;">Aucune prédiction enregistrée.</p>' : '';
        logs.slice().reverse().forEach(entry => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="hist-header"><span>🗓️ ${entry.date}</span></div>
                <div style="font-size:0.85rem; opacity:0.8; margin-bottom:10px;">Lune: ${entry.moon_weight}</div>
                <div style="font-size:0.75rem; color:var(--box-dark); line-height:1.4;">
                    ${entry.grilles.map(g => g.nums.join(',') + ' [' + g.etoiles.join(',') + ']').join('<br>')}
                </div>
            `;
            historyList.appendChild(item);
        });
    }
});
