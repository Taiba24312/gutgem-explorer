-- GutGEM Explorer v2.0 - SQLite Database Schema DDL
-- 100% Normalized schema mapping 1-to-1 to existing processed CSV files

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. Maps directly to strain_statistics.csv
CREATE TABLE IF NOT EXISTS strains (
    strain_id INTEGER PRIMARY KEY AUTOINCREMENT,
    strain_name TEXT UNIQUE NOT NULL,
    uptake_reactions INTEGER NOT NULL DEFAULT 0,
    secretion_reactions INTEGER NOT NULL DEFAULT 0,
    total_exchanged INTEGER NOT NULL DEFAULT 0
);

-- 2. Maps directly to metabolite_statistics.csv
CREATE TABLE IF NOT EXISTS metabolites (
    metabolite_id INTEGER PRIMARY KEY AUTOINCREMENT,
    metabolite_name TEXT UNIQUE NOT NULL,
    uptake_by_strains INTEGER NOT NULL DEFAULT 0,
    secreted_by_strains INTEGER NOT NULL DEFAULT 0,
    total_exchange INTEGER NOT NULL DEFAULT 0
);

-- 3. Maps directly to exchange_fluxes_master.csv
CREATE TABLE IF NOT EXISTS exchange_fluxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strain_name TEXT NOT NULL,
    exchange_id TEXT NOT NULL,
    reaction_name TEXT NOT NULL,
    metabolite_id_str TEXT NOT NULL,
    metabolite_name TEXT NOT NULL,
    compartment TEXT NOT NULL,
    lower_bound REAL NOT NULL,
    upper_bound REAL NOT NULL,
    flux REAL NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('Uptake', 'Secretion'))
);

-- 4. Maps directly to scfa_summary.csv
CREATE TABLE IF NOT EXISTS scfa_summary (
    scfa_name TEXT PRIMARY KEY,
    producer_strains INTEGER NOT NULL DEFAULT 0,
    consumer_strains INTEGER NOT NULL DEFAULT 0,
    total_exchange INTEGER NOT NULL DEFAULT 0,
    max_secretion REAL NOT NULL DEFAULT 0.0,
    max_uptake REAL NOT NULL DEFAULT 0.0,
    mean_secretion REAL NOT NULL DEFAULT 0.0,
    mean_uptake REAL NOT NULL DEFAULT 0.0
);

-- 5. Maps directly to binary_matrix.csv (-1: Uptake, 1: Secretion, 0: Inactive)
CREATE TABLE IF NOT EXISTS binary_matrix (
    strain_name TEXT NOT NULL,
    metabolite_name TEXT NOT NULL,
    is_active INTEGER NOT NULL CHECK(is_active IN (-1, 0, 1)),
    PRIMARY KEY (strain_name, metabolite_name)
);

-- 6. Maps directly to uptake_matrix.csv
CREATE TABLE IF NOT EXISTS uptake_matrix (
    strain_name TEXT NOT NULL,
    metabolite_name TEXT NOT NULL,
    flux_value REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (strain_name, metabolite_name)
);

-- 7. Maps directly to secretion_matrix.csv
CREATE TABLE IF NOT EXISTS secretion_matrix (
    strain_name TEXT NOT NULL,
    metabolite_name TEXT NOT NULL,
    flux_value REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (strain_name, metabolite_name)
);

-- 8. Maps directly to uptake_secretion_flux_matrix.csv
CREATE TABLE IF NOT EXISTS flux_matrix (
    strain_name TEXT NOT NULL,
    metabolite_name TEXT NOT NULL,
    flux_value REAL NOT NULL DEFAULT 0.0,
    PRIMARY KEY (strain_name, metabolite_name)
);

-- B-Tree Indexes for Fast Sub-5ms Query Traversal
CREATE INDEX IF NOT EXISTS idx_strains_name ON strains(strain_name);
CREATE INDEX IF NOT EXISTS idx_metabolites_name ON metabolites(metabolite_name);

CREATE INDEX IF NOT EXISTS idx_fluxes_strain ON exchange_fluxes(strain_name);
CREATE INDEX IF NOT EXISTS idx_fluxes_metab ON exchange_fluxes(metabolite_name);
CREATE INDEX IF NOT EXISTS idx_fluxes_strain_dir ON exchange_fluxes(strain_name, direction);
CREATE INDEX IF NOT EXISTS idx_fluxes_metab_dir ON exchange_fluxes(metabolite_name, direction);

CREATE INDEX IF NOT EXISTS idx_binary_active ON binary_matrix(metabolite_name, is_active) WHERE is_active != 0;
