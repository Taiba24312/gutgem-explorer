import os
import json
import pandas as pd

data_dir = r"C:\Users\taiba\.gemini\antigravity\scratch\gutgem-explorer\data"

print("1. Indexing strain_statistics.csv...")
df_strains = pd.read_csv(os.path.join(data_dir, "strain_statistics.csv"))
strains_list = df_strains.to_dict(orient="records")
with open(os.path.join(data_dir, "strains_index.json"), "w", encoding="utf-8") as f:
    json.dump(strains_list, f, indent=2)

print("2. Indexing metabolite_statistics.csv...")
df_metab = pd.read_csv(os.path.join(data_dir, "metabolite_statistics.csv"))
metab_list = df_metab.to_dict(orient="records")
with open(os.path.join(data_dir, "metabolites_index.json"), "w", encoding="utf-8") as f:
    json.dump(metab_list, f, indent=2)

print("3. Indexing scfa_summary.csv...")
df_scfa_sum = pd.read_csv(os.path.join(data_dir, "scfa_summary.csv"))
scfa_sum_list = df_scfa_sum.to_dict(orient="records")
with open(os.path.join(data_dir, "scfa_summary.json"), "w", encoding="utf-8") as f:
    json.dump(scfa_sum_list, f, indent=2)

print("4. Indexing scfa_matrix.csv...")
df_scfa_mat = pd.read_csv(os.path.join(data_dir, "scfa_matrix.csv"))
scfa_mat_dict = df_scfa_mat.to_dict(orient="records")
with open(os.path.join(data_dir, "scfa_matrix.json"), "w", encoding="utf-8") as f:
    json.dump(scfa_mat_dict, f, indent=2)

print("5. Processing exchange_fluxes_master.csv to build fast strain and metabolite maps...")
df_master = pd.read_csv(os.path.join(data_dir, "exchange_fluxes_master.csv"))

# Build Strain Map: strain -> list of {Exchange_ID, Reaction_Name, Metabolite_ID, Metabolite_Name, Flux, Direction}
strain_map = {}
for row in df_master.itertuples(index=False):
    st = row.Strain
    if st not in strain_map:
        strain_map[st] = {
            "uptake": [],
            "secretion": []
        }
    item = {
        "rxn_id": str(row.Exchange_ID),
        "rxn_name": str(row.Reaction_Name),
        "met_id": str(row.Metabolite_ID),
        "met_name": str(row.Metabolite_Name),
        "flux": round(float(row.Flux), 4)
    }
    if str(row.Direction).lower() == 'uptake':
        strain_map[st]["uptake"].append(item)
    else:
        strain_map[st]["secretion"].append(item)

with open(os.path.join(data_dir, "strain_flux_map.json"), "w", encoding="utf-8") as f:
    json.dump(strain_map, f)

print("6. Building Metabolite Strain Map: metabolite_name -> {uptake_strains: [{strain, flux}], secretion_strains: [{strain, flux}]}...")
metab_map = {}
for row in df_master.itertuples(index=False):
    m_name = str(row.Metabolite_Name)
    if m_name not in metab_map:
        metab_map[m_name] = {
            "uptake_strains": [],
            "secretion_strains": []
        }
    st_item = {
        "strain": str(row.Strain),
        "flux": round(float(row.Flux), 4)
    }
    if str(row.Direction).lower() == 'uptake':
        metab_map[m_name]["uptake_strains"].append(st_item)
    else:
        metab_map[m_name]["secretion_strains"].append(st_item)

with open(os.path.join(data_dir, "metabolite_strain_map.json"), "w", encoding="utf-8") as f:
    json.dump(metab_map, f)

print("Done! All JSON index files generated successfully.")
