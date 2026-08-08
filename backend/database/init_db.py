import os
import csv
import sqlite3
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")
DB_PATH = os.path.join(BASE_DIR, "database", "gutgem.sqlite")
SCHEMA_PATH = os.path.join(BASE_DIR, "database", "schema.sql")

def init_database():
    print("--- GutGEM Explorer Database Loader ---")
    print(f"Target SQLite DB: {DB_PATH}")
    print(f"Source Data Dir : {DATA_DIR}")

    if os.path.exists(DB_PATH):
        try:
            os.remove(DB_PATH)
            print("Removed existing gutgem.sqlite database.")
        except Exception as e:
            print(f"Notice: Existing DB active ({e}). Connecting directly.")

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Enable WAL mode for high performance
    cursor.execute("PRAGMA journal_mode = WAL;")

    # 1. Execute Schema DDL
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        schema_sql = f.read()
        cursor.executescript(schema_sql)
    print("[OK] Schema DDL executed successfully.")

    # Check if table already has data
    cursor.execute("SELECT COUNT(*) FROM exchange_fluxes")
    count = cursor.fetchone()[0]
    if count > 0:
        print(f"[OK] Database already populated with {count} exchange flux records.")
        conn.close()
        return

    # 2. Populate strains table from strain_statistics.csv
    print("Loading strains table from strain_statistics.csv...")
    strains_path = os.path.join(DATA_DIR, "strain_statistics.csv")
    with open(strains_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        strain_rows = [
            (row["Strain"], int(row["Uptake_Reactions"]), int(row["Secretion_Reactions"]), int(row["Total_Exchanged"]))
            for row in reader
        ]
        cursor.executemany(
            "INSERT OR IGNORE INTO strains (strain_name, uptake_reactions, secretion_reactions, total_exchanged) VALUES (?, ?, ?, ?)",
            strain_rows
        )
    print(f"[OK] Inserted {len(strain_rows)} strains.")

    # 3. Populate metabolites table from metabolite_statistics.csv
    print("Loading metabolites table from metabolite_statistics.csv...")
    metab_path = os.path.join(DATA_DIR, "metabolite_statistics.csv")
    with open(metab_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        metab_rows = [
            (row["Metabolite"], int(row["Uptake_By_Strains"]), int(row["Secreted_By_Strains"]), int(row["Total_Exchange"]))
            for row in reader
        ]
        cursor.executemany(
            "INSERT OR IGNORE INTO metabolites (metabolite_name, uptake_by_strains, secreted_by_strains, total_exchange) VALUES (?, ?, ?, ?)",
            metab_rows
        )
    print(f"[OK] Inserted {len(metab_rows)} metabolites.")

    # 4. Populate scfa_summary table
    print("Loading scfa_summary table...")
    scfa_path = os.path.join(DATA_DIR, "scfa_summary.csv")
    with open(scfa_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        scfa_rows = [
            (row["SCFA"], int(row["Producer_Strains"]), int(row["Consumer_Strains"]), int(row["Total_Exchange"]), float(row["Max_Secretion"]))
            for row in reader
        ]
        cursor.executemany(
            "INSERT OR IGNORE INTO scfa_summary (scfa_name, producer_strains, consumer_strains, total_exchange, max_secretion) VALUES (?, ?, ?, ?, ?)",
            scfa_rows
        )
    print(f"[OK] Inserted {len(scfa_rows)} SCFA summary records.")

    # 5. Populate exchange_fluxes master table
    print("Loading master exchange fluxes (252,983 records)...")
    t0 = time.time()
    fluxes_path = os.path.join(DATA_DIR, "exchange_fluxes_master.csv")
    with open(fluxes_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        flux_rows = [
            (row["Strain"], row["Exchange_ID"], row["Metabolite_Name"], float(row["Flux_Value"]))
            for row in reader
        ]
        cursor.executemany(
            "INSERT OR IGNORE INTO exchange_fluxes (strain_name, exchange_id, metabolite_name, flux_value) VALUES (?, ?, ?, ?)",
            flux_rows
        )
    conn.commit()
    print(f"[OK] Loaded {len(flux_rows)} master flux records in {time.time() - t0:.2f}s.")

    # 6. Populate sparse matrix tables
    print("Populating binary_matrix, uptake_matrix, secretion_matrix...")
    cursor.execute("""
        INSERT OR IGNORE INTO binary_matrix (strain_name, metabolite_name, is_active)
        SELECT strain_name, metabolite_name, 
               CASE WHEN flux_value > 0 THEN 1 WHEN flux_value < 0 THEN -1 ELSE 0 END
        FROM exchange_fluxes
        WHERE flux_value != 0;
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO uptake_matrix (strain_name, metabolite_name, flux_value)
        SELECT strain_name, metabolite_name, flux_value
        FROM exchange_fluxes
        WHERE flux_value < 0;
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO secretion_matrix (strain_name, metabolite_name, flux_value)
        SELECT strain_name, metabolite_name, flux_value
        FROM exchange_fluxes
        WHERE flux_value > 0;
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO flux_matrix (strain_name, metabolite_name, flux_value)
        SELECT strain_name, metabolite_name, flux_value
        FROM exchange_fluxes
        WHERE flux_value != 0;
    """)

    conn.commit()
    conn.close()
    print("🎉 Database Initialization Complete! gutgem.sqlite is ready.")

if __name__ == "__main__":
    init_database()
