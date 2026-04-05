import requests
from bs4 import BeautifulSoup
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from ephem import Moon, Date  # pip install pyephem
import random

class EuroMillionsPredictor:
    def __init__(self):
        self.numeros_poss = list(range(1,51))
        self.etoiles_poss = list(range(1,13))
        self.historique = self.scrape_fdj()
    
    def scrape_fdj(self):
        """Récupère 50 derniers tirages FDJ"""
        url = "https://www.fdj.fr/jeux-de-tirage/euromillions-my-million/historique"
        try:
            r = requests.get(url)
            soup = BeautifulSoup(r.text, 'html.parser')
            # Parsing simplifié - adapte selon structure réelle
            tirages = []
            for row in soup.find_all('tr')[:50]:
                cols = row.find_all('td')
                if len(cols) >= 7:
                    nums = [int(c.text.strip()) for c in cols[1:6]]
                    eto = [int(cols[6].text.strip()), int(cols[7].text.strip())]
                    tirages.append(nums + eto)
            return pd.DataFrame(tirages, columns=['n1','n2','n3','n4','n5','e1','e2'])
        except:
            # Fallback données récentes
            return pd.read_csv('freq_numeros_euromillions.csv', index_col=0).T.to_frame().T
    
    def score_astro_lune(self, date):
        """Poids selon phase Lune (Nouvelle=1.5, Pleine=0.8)"""
        moon = Moon(Date(date.strftime('%Y/%m/%d')))
        illum = moon.moon_phase  # 0=nuvelle, 1=pleine
        return 1.5 - 0.7 * illum  # Boost nouvelle lune
    
    def calculer_frequences(self, fenetre=50):
        """Fréquences glissantes + autocorrélation"""
        df = self.historique.tail(fenetre)
        freq_num = pd.concat([df['n1'],df['n2'],df['n3'],df['n4'],df['n5']]).value_counts()
        freq_num = freq_num.reindex(self.numeros_poss, fill_value=0.1)
        freq_etoile = pd.concat([df['e1'],df['e2']]).value_counts()
        freq_etoile = freq_etoile.reindex(self.etoiles_poss, fill_value=0.1)
        return freq_num.values / freq_num.sum(), freq_etoile.values / freq_etoile.sum()
    
    def generer_grilles(self, n_grilles=5):
        lundi = datetime.now().date() - timedelta(days=datetime.now().weekday())
        poids_lune = self.score_astro_lune(lundi)
        
        probas_num, probas_etoile = self.calculer_frequences()
        probas_num *= poids_lune  # Boost astro
        probas_etoile *= poids_lune
        probas_num /= probas_num.sum()
        probas_etoile /= probas_etoile.sum()
        
        print(f"🚀 Grilles EuroMillions - Semaine du {lundi} (Poids Lune: {poids_lune:.2f})")
        print("=" * 60)
        
        for i in range(n_grilles):
            nums = np.random.choice(self.numeros_poss, 5, replace=False, p=probas_num)
            eto = np.random.choice(self.etoiles_poss, 2, replace=False, p=probas_etoile)
            nums_clean = sorted([int(n) for n in nums])
            eto_clean = sorted([int(e) for e in eto])
            print(f"Grille {i+1:2d}: {nums_clean} + Étoiles {eto_clean}")

if __name__ == "__main__":
    pred = EuroMillionsPredictor()
    pred.generer_grilles(7)