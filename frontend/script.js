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

    // TAB SWITCHER
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

    // GENERATE
    generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true;
        btnLoader.style.display = 'block';
        
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ num_grilles: parseInt(numGrillesSelect.value) })
            });
            
            const data = await response.json();
            
            dateDisplay.textContent = data.date;
            moonDisplay.textContent = data.poids_lune;
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
        } catch (err) {
            alert("Erreur de connexion : " + err.message);
        } finally {
            generateBtn.disabled = false;
            btnLoader.style.display = 'none';
        }
    });

    // HISTORY LOGIC
    async function loadHistory() {
        try {
            const response = await fetch('/api/history');
            const logs = await response.json();
            historyList.innerHTML = '';

            if (logs.length === 0) {
                historyList.innerHTML = '<p style="text-align:center; opacity:0.6; margin-top:2rem;">Aucune prédiction enregistrée pour le moment.</p>';
                return;
            }

            // Reverse for newest first
            logs.slice().reverse().forEach(entry => {
                const item = document.createElement('div');
                item.className = 'history-item';
                
                let resultsHtml = '';
                if (entry.results) {
                    resultsHtml = `<div class="score-badge">Meilleur score: ${entry.score} pts</div>`;
                } else {
                    resultsHtml = `
                        <div class="verify-form" id="form-${entry.id}">
                            <small style="width:100%; margin-bottom:5px;">Entrer tirage réel :</small>
                            <input type="number" placeholder="N1" id="n1-${entry.id}">
                            <input type="number" placeholder="N2" id="n2-${entry.id}">
                            <input type="number" placeholder="N3" id="n3-${entry.id}">
                            <input type="number" placeholder="N4" id="n4-${entry.id}">
                            <input type="number" placeholder="N5" id="n5-${entry.id}">
                            &nbsp;
                            <input type="number" placeholder="E1" id="e1-${entry.id}">
                            <input type="number" placeholder="E2" id="e2-${entry.id}">
                            <button class="verify-btn" onclick="verify('${entry.id}')">Vérifier</button>
                        </div>
                    `;
                }

                item.innerHTML = `
                    <div class="hist-header">
                        <span>🗓️ ${entry.date_generated}</span>
                        ${resultsHtml}
                    </div>
                    <div style="font-size:0.85rem; opacity:0.8; margin-bottom:10px;">
                        Lune: ${entry.moon_weight} | ${entry.grids.length} grilles
                    </div>
                    <div style="font-size:0.75rem; color:var(--box-dark); line-height:1.4;">
                        ${entry.grids.map(g => g.nums.join(',') + ' [' + g.etoiles.join(',') + ']').join('<br>')}
                    </div>
                `;
                historyList.appendChild(item);
            });
        } catch (err) {
            console.error(err);
        }
    }

    // Window global for onclick access
    window.verify = async (id) => {
        const results = {
            nums: [
                parseInt(document.getElementById(`n1-${id}`).value),
                parseInt(document.getElementById(`n2-${id}`).value),
                parseInt(document.getElementById(`n3-${id}`).value),
                parseInt(document.getElementById(`n4-${id}`).value),
                parseInt(document.getElementById(`n5-${id}`).value)
            ],
            stars: [
                parseInt(document.getElementById(`e1-${id}`).value),
                parseInt(document.getElementById(`e2-${id}`).value)
            ]
        };

        if (results.nums.some(isNaN) || results.stars.some(isNaN)) {
            alert("Veuillez remplir tous les numéros.");
            return;
        }

        try {
            const res = await fetch('/api/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, results })
            });
            const data = await res.json();
            if (data.status === 'success') {
                alert(`Vérification terminée ! Meilleur score : ${data.score}`);
                loadHistory();
            }
        } catch (err) {
            alert(err.message);
        }
    };
});
