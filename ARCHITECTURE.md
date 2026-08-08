# GutGEM Explorer (v1.0) - Project Architecture Document

## Overview

**GutGEM Explorer** is an interactive scientific knowledgebase web application designed for zero-programming exploration of human gut bacterial genome-scale metabolic model (GEM) exchange fluxes derived from AGORA2 and Flux Balance Analysis (FBA).

The architecture follows a **Decoupled Data-Driven Client-Side Single Page Application (SPA)** model. Data preprocessing is handled via Python script pre-indexing, while the frontend runs entirely in the browser using HTML5, Vanilla CSS, and JavaScript with CDN dependencies (Chart.js, PapaParse, Lucide).

---

## Directory Structure

```
gutgem-explorer/
├── index.html                  # Main HTML page markup & structural skeleton
├── styles.css                  # Design system, multi-theme variables, layout & animations
├── app.js                      # Core JavaScript logic, event handlers & data binding
├── generate_indices.py         # Python dataset indexing script
├── ARCHITECTURE.md             # Project architecture documentation (this file)
└── data/                       # Data repository (CSVs and generated JSON indices)
    ├── exchange_fluxes_master.csv
    ├── strain_statistics.csv
    ├── metabolite_statistics.csv
    ├── scfa_summary.csv
    ├── scfa_matrix.csv
    ├── binary_matrix.csv
    ├── uptake_matrix.csv
    ├── secretion_matrix.csv
    ├── uptake_secretion_flux_matrix.csv
    ├── merge_report.txt
    ├── strains_index.json
    ├── metabolites_index.json
    ├── scfa_summary.json
    ├── scfa_matrix.json
    ├── strain_flux_map.json
    └── metabolite_strain_map.json
```

---

## Architectural Component Breakdown

### 1. Where HTML is Stored (`index.html`)

- **File Path**: `index.html`
- **Purpose**: Defines the complete DOM structure for all 9 application modules, top navigation bar, header brand emblem, modal popups, and CDN script references.
- **Key Sections**:
  - `<header class="app-header">`: Contains the anatomical gut SVG logo emblem, project branding, stats badges, theme selector dropdown (`#theme-selector`), custom file upload trigger, and module navigation tabs (`.nav-tab`).
  - `<main class="app-container">`: Contains 9 modular `<section class="tab-content">` containers:
    1. `#home-overview`: Overview text, primary statistics counters, 5-step workflow pipeline diagram, scientific novelty callout, and top uptake/secretion bar chart canvases.
    2. `#strain-explorer`: Searchable strain dropdown (`#strain-select`), metadata stats cards, and dual uptake/secretion tables.
    3. `#metabolite-explorer`: Metabolite dropdown (`#metabolite-select`), metadata summary cards, and dual uptaking/secreting strain tables.
    4. `#scfa-explorer`: SCFA selector (`#scfa-select`), summary metrics, and filterable strain breakdown table.
    5. `#compare-strains`: Strain A & Strain B selectors, Jaccard similarity score cards, and common shared uptake/secretion tables.
    6. `#exchangeome-explorer`: Global metabolite exchange prevalence ranking table with inorganic ion toggle switch (`#chk-exclude-ions`).
    7. `#heatmap-explorer`: Canvas element (`#heatmap-canvas`) for rendering binary exchange heatmaps.
    8. `#downloads-hub`: Direct download buttons for processed CSV datasets.
    9. `#about-methodology`: Scientific background, AGORA2 attribution, FBA setup, objective function, and scientific limitations.
  - `<div id="modal-uploader">`: Modal pop-up dialog with drag-and-drop file dropzone for custom user CSV uploads.

---

### 2. Where CSS is Stored (`styles.css`)

- **File Path**: `styles.css`
- **Purpose**: Implements the complete scientific styling system, responsive grid layouts, custom typography, table styles, card containers, toggle switches, glassmorphism header effects, and multi-theme color variables.
- **Key Sections**:
  - **Multi-Theme Variable System**:
    - `[data-theme="dark"]` (Default): Biomedical Dark theme with Midnight Navy (`#080c14`), Neon Emerald (`#10b981`), and Electric Cyan (`#06b6d4`).
    - `[data-theme="pastel"]`: Clinical Pastel theme with light lavender background (`#f4f6fc`), crisp white cards, and sky blue accents.
    - `[data-theme="emerald"]`: Microbiome Emerald theme with Deep Forest Slate (`#061512`) and bright Mint (`#34d399`).
    - `[data-theme="cyber"]`: Cyber Bio-Tech theme with Deep Space Dark (`#0d0914`), Electric Pink (`#ec4899`), and Cyan (`#06b6d4`).
  - **Layout Components**: `.app-header`, `.brand-logo-gut-emblem`, `.nav-tabs`, `.stats-grid`, `.stat-card`, `.workflow-container`, `.data-table`, `.comparison-grid`, `.similarity-score-box`, `.heatmap-container`, `.btn`, `.toggle-switch`.

---

### 3. Where JavaScript is Stored (`app.js`)

- **File Path**: `app.js`
- **Purpose**: Controls all client-side dynamic logic, dataset querying, DOM manipulation, tab navigation, theme switching, Chart.js visualization rendering, Canvas heatmap drawing, Jaccard score computation, and custom file parsing.
- **Key Modules & Functionality**:
  - `loadData()`: Asynchronously fetches pre-indexed JSON files from `./data/` into global state.
  - `setupThemeSelector()`: Manages live theme switching (`dark`, `pastel`, `emerald`, `cyber`), persists preferences in `localStorage`, and updates `data-theme` attributes on `<html>`.
  - `setupTabs()`: Handles tab click events, active tab switching, and triggers Heatmap canvas redraws.
  - `initHomeOverview()`: Instantiates Chart.js horizontal bar charts for Top 10 Uptake and Top 10 Secreted metabolites.
  - `initStrainExplorer()`: Populates strain dropdown, reads strain flux map, updates metadata cards, and populates uptake/secretion tables.
  - `initMetaboliteExplorer()`: Populates metabolite dropdown, reads metabolite strain map, and populates uptaking/secreting strain tables.
  - `initSCFAExplorer()`: Displays SCFA metrics and filterable strain role tables (Producers vs Consumers).
  - `initCompareStrains()`: Computes Jaccard Similarity Scores for Uptake, Secretion, and Combined exchange profiles between two selected strains.
  - `initExchangeomeExplorer()`: Renders ranked exchangeome prevalence table and applies the Inorganic Ion filter.
  - `renderHeatmap()`: Draws binary exchange heatmap cells on HTML5 Canvas.
  - `setupUploader()`: Uses PapaParse to parse custom drag-and-drop CSV files.

---

### 4. Where Data Pre-processing is Implemented (`generate_indices.py`)

- **File Path**: `generate_indices.py`
- **Purpose**: Python pre-indexing script executed during dataset initialization. It reads the raw FBA master CSV dataset (`exchange_fluxes_master.csv`) containing 252,983 records and builds lightweight, optimized JSON indices for instant browser fetching.
- **Output Files Generated in `./data/`**:
  - `strains_index.json`: Array of 3,464 strain records with reaction counts.
  - `metabolites_index.json`: Array of 512 metabolite records with uptake/secretion counts.
  - `scfa_summary.json`: Summary stats for 7 Short-Chain Fatty Acids.
  - `scfa_matrix.json`: Strain x SCFA matrix records.
  - `strain_flux_map.json`: Key-value map (`Strain` ➔ `{uptake: [...], secretion: [...]}`) for $O(1)$ strain lookups.
  - `metabolite_strain_map.json`: Key-value map (`Metabolite_Name` ➔ `{uptake_strains: [...], secretion_strains: [...]}`) for $O(1)$ metabolite lookups.

---

### 5. Where Data Loading is Implemented

Data loading occurs in **two distinct stages**:

1. **Build-Time / Server Pre-indexing (Offline Phase)**:
   - **Implemented In**: `generate_indices.py`
   - **Operation**: Converts 30.5 MB `exchange_fluxes_master.csv` into indexed JSON files (`strain_flux_map.json`, `metabolite_strain_map.json`, `strains_index.json`, `metabolites_index.json`) stored in `./data/`.

2. **Runtime Client-Side Data Fetching (Browser Phase)**:
   - **Implemented In**: `app.js` inside the `async function loadData()` routine.
   - **Operation**:
     ```javascript
     const [strainsRes, metabRes, scfaSumRes, scfaMatRes, strainFluxRes, metabStrainRes] = await Promise.all([
       fetch('./data/strains_index.json'),
       fetch('./data/metabolites_index.json'),
       fetch('./data/scfa_summary.json'),
       fetch('./data/scfa_matrix.json'),
       fetch('./data/strain_flux_map.json'),
       fetch('./data/metabolite_strain_map.json')
     ]);
     ```
   - Stores parsed JSON objects in memory (`globalData`), allowing instant zero-latency filtering, Jaccard comparison, and table rendering without repeated HTTP requests.
   - **Custom Data Upload**: Implemented in `setupUploader()` using `Papa.parse(file, { ... })` for dynamic user-uploaded CSV file loading.

---

## File Summary Table

| File Name | Purpose / Responsibility | Language / Format |
| :--- | :--- | :--- |
| `index.html` | Structural skeleton, navigation, sections, modals, CDN tags | HTML5 |
| `styles.css` | Design system, glassmorphism, multi-theme variables, tables | CSS3 |
| `app.js` | UI interactivity, theme switching, tab navigation, Chart.js/Canvas | JavaScript (ES6) |
| `generate_indices.py` | Data parsing script (252,983 rows ➔ JSON indices) | Python 3 |
| `data/*.csv` | Processed research datasets available for download | CSV |
| `data/*.json` | Pre-indexed fast lookup files fetched by browser | JSON |
| `ARCHITECTURE.md` | System architecture documentation | Markdown |
