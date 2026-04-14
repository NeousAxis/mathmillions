document.addEventListener('DOMContentLoaded', () => {
    let currentMode = 'euro';
    let dataset = ARCHIVES;

    const numGrillesSelect = document.getElementById('numGrilles');
    const generateBtn = document.getElementById('generate-btn');
    const btnLoader = document.getElementById('btn-loader');
    const resultsPanel = document.getElementById('results');
    const dateDisplay = document.getElementById('date-display');
    const moonDisplay = document.getElementById('moon-display');
    const insightBox = document.getElementById('insight-box');
    const gridsContainer = document.getElementById('grids-container');

    const modeEuroBtn = document.getElementById('mode-euro');
    const modeSwissBtn = document.getElementById('mode-swiss');

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

    function updateSigNumOptions() {
        sigNumSelect.innerHTML = '';
        const max = currentMode === 'euro' ? 50 : 42;
        for (let i = 1; i <= max; i++) {
            const opt = document.createElement('option');
            opt.value = i; opt.textContent = i;
            sigNumSelect.appendChild(opt);
        }
    }
    updateSigNumOptions();

    const PLANET_KEYS = ['pos_sun', 'pos_moon', 'pos_merc', 'pos_ven', 'pos_mars', 'pos_jup', 'pos_sat'];
    const ZODIAC = ["Bélier", "Taureau", "Gémeaux", "Cancer", "Lion", "Vierge", "Balance", "Scorpion", "Sagittaire", "Capricorne", "Verseau", "Poissons"];
    function getSign(lon) { return ZODIAC[Math.floor((lon % 360) / 30)]; }

    function getCurrentSkyChart() {
        const time = new Astronomy.AstroTime(new Date());
        const bodies = { 'sun': Astronomy.Body.Sun, 'moon': Astronomy.Body.Moon, 'merc': Astronomy.Body.Mercury, 'ven': Astronomy.Body.Venus, 'mars': Astronomy.Body.Mars, 'jup': Astronomy.Body.Jupiter, 'sat': Astronomy.Body.Saturn };
        const chart = {};
        for (let [name, body] of Object.entries(bodies)) {
            chart[`pos_${name}`] = Astronomy.EclipticLongitude(body, time);
        }
        const moonInfo = Astronomy.Illumination(Astronomy.Body.Moon, time);
        chart.moon_illum = moonInfo.phase_fraction;
        return chart;
    }



    function generateGrillesStatic(n_grilles) {
        const currentChart = getCurrentSkyChart();
        const activeArchive = currentMode === 'euro' ? ARCHIVES : ARCHIVES_SWISS;
        
        function getAdjustedProbs(possibilities, colKeys) {
            let sumTotal = 0;
            const results = [];
            const totalDraws = activeArchive.length;
            if (totalDraws === 0) return possibilities.map(p => ({num: p, prob: 1, normalized: 1/possibilities.length}));

            for (let num of possibilities) {
                const wins = activeArchive.filter(row => colKeys.some(k => row[k] === num));
                const p_base = wins.length / totalDraws; // Fréquence de base

                if (wins.length === 0) {
                    results.push({ num, prob: 0.0001, normalized: 0 });
                    sumTotal += 0.0001;
                    continue;
                }

                let celestial_boost = 0;
                PLANET_KEYS.forEach(pk => {
                    let sum_sin = 0, sum_cos = 0;
                    wins.forEach(w => {
                        const rad = w[pk] * Math.PI / 180;
                        sum_sin += Math.sin(rad);
                        sum_cos += Math.cos(rad);
                    });
                    const mean_sin = sum_sin / wins.length;
                    const mean_cos = sum_cos / wins.length;
                    const R = Math.sqrt(mean_sin*mean_sin + mean_cos*mean_cos); // Force de la concentration (0 à 1)
                    const avg_rad = Math.atan2(mean_sin, mean_cos); // Angle d'attraction
                    
                    const current_rad = currentChart[pk] * Math.PI / 180;
                    // L'alignement est maximal (1) si la planète est au même angle, et minimal (-1) si elle est à l'opposé.
                    const alignment = Math.cos(current_rad - avg_rad); 
                    
                    celestial_boost += R * alignment;
                });
                
                // Utilisation d'une fonction exponentielle pour amplifier naturellement les résonances astrologiques
                const sensitivity = 0.5; // Puissance de l'influence céleste
                let prob = p_base * Math.exp(sensitivity * celestial_boost);
                prob = Math.max(0.0001, prob);
                
                results.push({ num, prob, normalized: 0 });
                sumTotal += prob;
            }
            return results.map(r => ({ ...r, normalized: r.prob / sumTotal }));
        }

        const numsCount = currentMode === 'euro' ? 5 : 6;
        const numsMax = currentMode === 'euro' ? 50 : 42;
        const starCount = currentMode === 'euro' ? 2 : 1;
        const starMax = currentMode === 'euro' ? 12 : 6;
        const numCols = currentMode === 'euro' ? ['n1','n2','n3','n4','n5'] : ['n1','n2','n3','n4','n5', 'n6'];
        const starCols = currentMode === 'euro' ? ['e1','e2'] : ['lucky'];

        const numProbs = getAdjustedProbs(Array.from({length: numsMax}, (_, i) => i + 1), numCols);
        const starProbs = getAdjustedProbs(Array.from({length: starMax}, (_, i) => i + 1), starCols);

        function weightedRandom(data, count) {
            const picks = []; const pool = JSON.parse(JSON.stringify(data));
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
            grilles.push({ nums: weightedRandom(numProbs, numsCount), etoiles: weightedRandom(starProbs, starCount) });
        }

        return { id: Date.now(), date: new Date().toLocaleDateString('fr-CH'), moon_weight: currentChart.moon_illum.toFixed(2), grilles };
    }

    // === UI ===
    function updateSignature(num) {
        num = parseInt(num);
        const activeArchive = currentMode === 'euro' ? ARCHIVES : ARCHIVES_SWISS;
        const cols = currentMode === 'euro' ? ['n1','n2','n3','n4','n5'] : ['n1','n2','n3','n4','n5','n6'];
        const wins = activeArchive.filter(row => cols.some(k => row[k] === num));
        if (wins.length === 0) { sigReport.textContent = "Aucun historique."; sigChart.innerHTML = ""; return; }
        sigReport.innerHTML = `Le numéro <strong>${num}</strong> (${currentMode}) est sorti <strong>${wins.length} fois</strong>. Sa signature :`;
        sigChart.innerHTML = "";
        PLANET_KEYS.forEach(pk => {
            const avgPos = wins.map(d => d[pk]).reduce((a, b) => a + b) / wins.length;
            const sign = getSign(avgPos);
            const row = document.createElement('div');
            row.className = 'sig-row';
            row.innerHTML = `<span class="sig-planet">${pk.replace('pos_','')}</span><span class="sig-pos">${Math.round(avgPos)}° (${sign})</span><div class="sig-bar-container"><div class="sig-bar" style="width: ${(avgPos/360)*100}%"></div></div>`;
            sigChart.appendChild(row);
        });
    }

    function switchMode(mode) {
        currentMode = mode;
        modeEuroBtn.classList.toggle('active', mode === 'euro');
        modeSwissBtn.classList.toggle('active', mode === 'swiss');
        updateSigNumOptions();
        updateSignature(sigNumSelect.value);
    }

    modeEuroBtn.addEventListener('click', () => switchMode('euro'));
    modeSwissBtn.addEventListener('click', () => switchMode('swiss'));
    tabSigBtn.addEventListener('click', () => {
        calcView.classList.add('hidden'); historyView.classList.add('hidden'); signatureView.classList.remove('hidden');
        [tabCalcBtn, tabHistBtn, tabSigBtn].forEach(b => b.classList.remove('active')); tabSigBtn.classList.add('active');
        updateSignature(sigNumSelect.value);
    });
    tabCalcBtn.addEventListener('click', () => {
        calcView.classList.remove('hidden'); historyView.classList.add('hidden'); signatureView.classList.add('hidden');
        [tabCalcBtn, tabHistBtn, tabSigBtn].forEach(b => b.classList.remove('active')); tabCalcBtn.classList.add('active');
    });
    tabHistBtn.addEventListener('click', () => {
        calcView.classList.add('hidden'); historyView.classList.remove('hidden'); signatureView.classList.add('hidden');
        [tabCalcBtn, tabHistBtn, tabSigBtn].forEach(b => b.classList.remove('active')); tabHistBtn.classList.add('active');
        loadHistory();
    });
    sigNumSelect.addEventListener('change', () => updateSignature(sigNumSelect.value));

    generateBtn.addEventListener('click', () => {
        generateBtn.disabled = true; btnLoader.style.display = 'block';
        setTimeout(() => {
            try {
                const data = generateGrillesStatic(parseInt(numGrillesSelect.value));
                dateDisplay.textContent = data.date; moonDisplay.textContent = data.moon_weight;
                insightBox.innerHTML = `<strong>Analyse MATHMILLIONS (${currentMode.toUpperCase()}) :</strong><br>Le ciel de ce soir est corrélé aux signatures gagnantes de cette loterie.`;
                gridsContainer.innerHTML = '';
                data.grilles.forEach((grid, i) => {
                    const row = document.createElement('div');
                    row.className = 'grid-row';
                    row.innerHTML = `<span class="grid-id">#${i+1}</span><div class="numbers">${grid.nums.map(n => `<span class="ball">${n}</span>`).join('')}</div><span class="plus">+</span><div class="stars">${grid.etoiles.map(s => `<span class="ball star">${s}</span>`).join('')}</div>`;
                    gridsContainer.appendChild(row);
                });
                resultsPanel.classList.remove('hidden'); 
                saveToLocal(data);
            } catch (err) {
                console.error(err);
                document.body.innerHTML += "<div id='test-error' style='position:absolute;top:0;left:0;background:red;color:white;z-index:9999;padding:20px;'>" + err.message + "<br><pre>" + err.stack + "</pre></div>";
            } finally {
                generateBtn.disabled = false; btnLoader.style.display = 'none';
            }
        }, 500);
    });

    function saveToLocal(prediction) {
        prediction.mode = currentMode;
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
            const modeName = entry.mode ? entry.mode.toUpperCase() : 'EURO';
            item.innerHTML = `
                <div class="hist-header"><span>🗓️ ${entry.date} (${modeName})</span></div>
                <div style="font-size:0.85rem; opacity:0.8; margin-bottom:10px;">Lune: ${entry.moon_weight}</div>
                <div style="font-size:0.75rem; color:var(--box-dark); line-height:1.4;">
                    ${entry.grilles.map(g => g.nums.join(',') + ' [' + g.etoiles.join(',') + ']').join('<br>')}
                </div>
            `;
            historyList.appendChild(item);
        });
    }
});
