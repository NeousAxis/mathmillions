import requests
import zipfile
import io
import pandas as pd
import os

print("Téléchargement des archives FDJ officielles AVEC DATES...")

urls = [
    "https://media.fdj.fr/static/csv/euromillions/euromillions_3.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_4.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_200402.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_201105.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_201402.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_201609.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_201902.zip",
    "https://media.fdj.fr/static/csv/euromillions/euromillions_202002.zip"
]

all_draws = []

for url in urls:
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                for filename in z.namelist():
                    if filename.endswith(".csv"):
                        with z.open(filename) as f:
                            df = pd.read_csv(f, sep=";", encoding="ISO-8859-1")
                            
                            boule_cols = [c for c in df.columns if "boule" in c.lower() and "1" in c.lower() and "etoile" not in c.lower()]
                            etoile_cols = [c for c in df.columns if "etoile" in c.lower() and "1" in c.lower()]
                            
                            # Find date column
                            date_col = next((c for c in df.columns if "date" in c.lower() and "tirage" in c.lower()), None)
                            if not date_col:
                                date_col = next((c for c in df.columns if "jour" in c.lower() and "tirage" in c.lower()), None)
                                
                            if len(boule_cols) > 0 and len(etoile_cols) > 0 and date_col:
                                b_base = boule_cols[0].replace("1", "")
                                e_base = etoile_cols[0].replace("1", "")
                                
                                try:
                                    temp = df[[date_col, f"{b_base}1", f"{b_base}2", f"{b_base}3", f"{b_base}4", f"{b_base}5", f"{e_base}1", f"{e_base}2"]].copy()
                                    temp.columns = ['date', 'n1','n2','n3','n4','n5','e1','e2']
                                    temp = temp.dropna()
                                    all_draws.append(temp)
                                except Exception as inner_e:
                                    pass
    except Exception:
        pass

if len(all_draws) > 0:
    temp_df = pd.concat(all_draws)
    
    # Nettoyage
    for col in ['n1','n2','n3','n4','n5','e1','e2']:
        if temp_df[col].dtype == object:
            temp_df[col] = temp_df[col].astype(str).str.replace(r'[\D]+', '', regex=True)
            
    # Conversion date
    # Usually FDJ format is DD/MM/YYYY
    temp_df['date'] = pd.to_datetime(temp_df['date'], format='%d/%m/%Y', errors='coerce')
    
    # Drop rows where date parsing failed or numbers are NaN
    temp_df = temp_df.dropna(subset=['date'])
    temp_df[['n1','n2','n3','n4','n5','e1','e2']] = temp_df[['n1','n2','n3','n4','n5','e1','e2']].apply(pd.to_numeric, errors='coerce')
    final_df = temp_df.dropna().drop_duplicates(subset=['date'])
    final_df[['n1','n2','n3','n4','n5','e1','e2']] = final_df[['n1','n2','n3','n4','n5','e1','e2']].astype(int)
    
    # Sort by date
    final_df = final_df.sort_values('date').reset_index(drop=True)
    
    final_df.to_csv("archives_euromillions.csv", index=False)
    print(f"Terminé. {len(final_df)} tirages avec dates sauvegardés.")
