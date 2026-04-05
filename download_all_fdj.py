import requests
import zipfile
import io
import pandas as pd
import os

print("Téléchargement des archives FDJ officielles...")

urls = [
    "https://media.fdj.fr/static/csv/euromillions/euromillions_3.zip", # very old fdj structure might use these naming conventions
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
            print(f"Extraction avec succès : {url.split('/')[-1]}")
            with zipfile.ZipFile(io.BytesIO(r.content)) as z:
                # Find the csv file inside the zip
                for filename in z.namelist():
                    if filename.endswith(".csv"):
                        with z.open(filename) as f:
                            # FDJ CSVs are usually separated by semicolon
                            df = pd.read_csv(f, sep=";", encoding="ISO-8859-1")
                            
                            # Different variations of column names in FDJ history
                            # Usually looking for "boule_1", "boule_2", "etoile_1", "etoile_2"
                            boule_cols = [c for c in df.columns if "boule" in c.lower() and "1" in c.lower() and "etoile" not in c.lower()]
                            etoile_cols = [c for c in df.columns if "etoile" in c.lower() and "1" in c.lower()]
                            
                            if len(boule_cols) > 0 and len(etoile_cols) > 0:
                                b1 = boule_cols[0]
                                b_base = b1.replace("1", "")
                                e1 = etoile_cols[0]
                                e_base = e1.replace("1", "")
                                
                                try:
                                    temp = df[[f"{b_base}1", f"{b_base}2", f"{b_base}3", f"{b_base}4", f"{b_base}5", f"{e_base}1", f"{e_base}2"]].copy()
                                    temp.columns = ['n1','n2','n3','n4','n5','e1','e2']
                                    temp = temp.dropna()
                                    all_draws.append(temp)
                                    print(f"-> Ajouté {len(temp)} tirages depuis {filename}")
                                except Exception as inner_e:
                                    print(f"Erreur extraction colonnes pour {filename} : {inner_e}")
    except Exception as e:
        print(f"Inaccessible: {url} ({e})")

if len(all_draws) > 0:
    temp_df = pd.concat(all_draws)
    
    # Nettoyage des chaînes comme "-6-9-13-39-41-" qui pourraient exister (FDJ met parfois des tirets)
    for col in temp_df.columns:
        if temp_df[col].dtype == object:
            temp_df[col] = temp_df[col].astype(str).str.replace(r'[\D]+', '', regex=True)
            
    final_df = temp_df.apply(pd.to_numeric, errors='coerce').dropna().astype(int).drop_duplicates()
    final_df.to_csv("archives_euromillions_full.csv", index=False)
    print(f"Terminé. {len(final_df)} tirages totaux sauvegardés dans archives_euromillions_full.csv.")
else:
    print("Échec total, aucun ZIP n'a été exploité.")
