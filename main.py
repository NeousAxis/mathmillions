from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn
import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np
from datetime import datetime, date
from ephem import Moon, Date
import os
import json

app = FastAPI()

# File to store predictions
PREDICTIONS_FILE = "predictions_log.json"

class PredictionEntry(BaseModel):
    id: str
    date_generated: str
    target_draw_date: str
    grids: list
    moon_weight: float
    results: dict = None # To be filled later (e.g. {"nums": [1,2,3...], "stars": [1,2]})
    score: float = 0 # Match score

class EuroMillionsPredictor:
    def __init__(self):
        self.numeros_poss = list(range(1,51))
        self.etoiles_poss = list(range(1,13))
    
    def update_archive_from_fdj(self):
        try:
            headers = {'User-Agent': 'Mozilla/5.0'}
            url = "https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/historique"
            r = requests.get(url, headers=headers, timeout=5)
            soup = BeautifulSoup(r.text, 'html.parser')
            tirages = []
            for row in soup.find_all('tr')[:50]:
                cols = row.find_all('td')
                if len(cols) >= 7:
                    nums = [int(c.text.strip()) for c in cols[1:6]]
                    eto = [int(cols[6].text.strip()), int(cols[7].text.strip())]
                    tirages.append(nums + eto)
            
            if len(tirages) > 0:
                df_new = pd.DataFrame(tirages, columns=['n1','n2','n3','n4','n5','e1','e2'])
                if os.path.exists('archives_euromillions.csv'):
                    df_old = pd.read_csv('archives_euromillions.csv')
                    df_combined = pd.concat([df_new, df_old]).drop_duplicates().reset_index(drop=True)
                    df_combined.to_csv('archives_euromillions.csv', index=False)
                else:
                    df_new.to_csv('archives_euromillions.csv', index=False)
        except Exception:
            pass
            
    def get_historique_from_db(self):
        if not os.path.exists('archives_euromillions.csv'):
            self.update_archive_from_fdj()
            if not os.path.exists('archives_euromillions.csv'):
                raise Exception("Base de données locale manquante.")
        return pd.read_csv('archives_euromillions.csv')
    
    def generer_grilles(self, n_grilles=5):
        df = self.get_historique_from_db()
        d_today = datetime.now()
        moon_today = Moon(Date(d_today.strftime('%Y/%m/%d')))
        illum_today = moon_today.moon_phase
        
        def calc_illum(date_val):
            try:
                if pd.isna(date_val): return 0.5
                d_val = pd.to_datetime(date_val, dayfirst=True)
                return Moon(Date(d_val.strftime('%Y/%m/%d'))).moon_phase
            except: return 0.5
                
        Y = df['date'].apply(calc_illum).values
        Y_mean = np.mean(Y)
        Y_std = np.std(Y) if np.std(Y) > 0 else 1.0
        
        def calculate_adjusted_probs(possibilities, col_names):
            probs = []
            infos = []
            for num in possibilities:
                X = df[col_names].apply(lambda row: 1 if num in row.values else 0, axis=1).values
                X_mean = np.mean(X)
                rho = np.corrcoef(X, Y)[0, 1] if np.std(X) > 0 else 0
                if np.isnan(rho): rho = 0
                adjusted_prob = max(0.0001, X_mean + rho * (np.std(X) / Y_std) * (illum_today - Y_mean))
                probs.append(adjusted_prob)
                infos.append({"num": num, "freq": X_mean, "rho": rho})
            return np.array(probs) / np.sum(probs), infos
            
        probas_num, infos_num = calculate_adjusted_probs(self.numeros_poss, ['n1','n2','n3','n4','n5'])
        probas_etoile, infos_etoile = calculate_adjusted_probs(self.etoiles_poss, ['e1','e2'])
        
        delta_y = illum_today - Y_mean
        infos_num.sort(key=lambda x: x['rho'] * delta_y, reverse=True)
        top_astro = [str(x['num']) for x in infos_num[:3]]
        infos_num.sort(key=lambda x: x['freq'], reverse=True)
        freq_str = ", ".join([f"le {x['num']} ({int(x['freq'] * len(df))} sorties)" for x in infos_num[:3]])
        
        if illum_today > 0.9: phase = "Pleine Lune"
        elif illum_today < 0.1: phase = "Nouvelle Lune"
        else: phase = f"Lune ({int(illum_today*100)}%)"

        explanation = (
            f"<strong>1. Statistiques :</strong> {freq_str} dominent l'historique.<br>"
            f"<strong>2. Astrologie :</strong> En cette phase {phase}, le moteur cible les numéros <strong>{', '.join(top_astro)}</strong>.<br>"
            f"<strong>3. Poids Lunaire ({round(illum_today, 2)}) :</strong> Pivot de corrélation historique."
        )
        
        resultats = []
        for i in range(n_grilles):
            nums = sorted([int(n) for n in np.random.choice(self.numeros_poss, 5, replace=False, p=probas_num)])
            eto = sorted([int(e) for e in np.random.choice(self.etoiles_poss, 2, replace=False, p=probas_etoile)])
            resultats.append({"nums": nums, "etoiles": eto})
            
        # Log prediction
        prediction_id = datetime.now().strftime("%Y%m%d%H%M%S")
        new_entry = {
            "id": prediction_id,
            "date_generated": d_today.strftime("%d/%m/%Y %H:%M"),
            "target_draw_date": "Prochain tirage",
            "grids": resultats,
            "moon_weight": round(illum_today, 2),
            "results": None,
            "score": 0
        }
        
        logs = []
        if os.path.exists(PREDICTIONS_FILE):
            with open(PREDICTIONS_FILE, "r") as f:
                logs = json.load(f)
        logs.append(new_entry)
        with open(PREDICTIONS_FILE, "w") as f:
            json.dump(logs, f, indent=4)

        return {
            "id": prediction_id,
            "date": d_today.strftime("%d/%m/%Y"),
            "poids_lune": round(illum_today, 2),
            "explanation": explanation,
            "grilles": resultats
        }

predictor = EuroMillionsPredictor()

class GenerateRequest(BaseModel):
    num_grilles: int

class VerifyRequest(BaseModel):
    id: str
    results: dict # {"nums": [1,2,3,4,5], "stars": [1,2]}

@app.post("/api/generate")
async def generate_api(req: GenerateRequest):
    return predictor.generer_grilles(req.num_grilles)

@app.get("/api/history")
async def get_history():
    if not os.path.exists(PREDICTIONS_FILE): return []
    with open(PREDICTIONS_FILE, "r") as f:
        return json.load(f)

@app.post("/api/verify")
async def verify_api(req: VerifyRequest):
    if not os.path.exists(PREDICTIONS_FILE):
        raise HTTPException(status_code=404, detail="Aucun log trouvé.")
    
    with open(PREDICTIONS_FILE, "r") as f:
        logs = json.load(f)
    
    found = False
    for entry in logs:
        if entry["id"] == req.id:
            entry["results"] = req.results
            # Score simple: nb de numéros + nb d'étoiles trouvés au total sur toutes les grilles? 
            # Non, on va chercher le meilleur match d'UNE SEULE grille.
            best_match = 0
            for grid in entry["grids"]:
                n_match = len(set(grid["nums"]) & set(req.results["nums"]))
                e_match = len(set(grid["etoiles"]) & set(req.results["stars"]))
                score = n_match + (e_match * 0.5) # Etoiles comptent un peu moins dans un score brut
                if score > best_match: best_match = score
            entry["score"] = best_match
            found = True
            break
            
    if not found: raise HTTPException(status_code=404, detail="ID non trouvé.")
    
    with open(PREDICTIONS_FILE, "w") as f:
        json.dump(logs, f, indent=4)
    return {"status": "success", "score": best_match}

app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
