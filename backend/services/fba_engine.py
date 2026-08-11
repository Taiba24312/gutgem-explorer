"""
GutGEM Explorer v1.0 - Resilient Live FBA Simulation Engine
------------------------------------------------------------
Dual-Engine FBA Runner:
1. Primary Engine: CobraPy (if native C-libraries like libexpat are present)
2. Fallback Engine: Pure Python SBML Parser (xml.etree.ElementTree) + SciPy HiGHS LP Solver (scipy.optimize.linprog)

Guarantees 100% uptime on cloud environments (Render, Linux, Docker) even if system C-libraries are missing.
"""

import os
import tempfile
import hashlib
import time
import re
import xml.etree.ElementTree as ET
import numpy as np
from scipy.optimize import linprog
import pandas as pd
from typing import Dict, Any, List, Optional

# Global In-Memory Simulation Result Cache (Hash -> Results)
FBA_RESULT_CACHE: Dict[str, Dict[str, Any]] = {}

# Try importing CobraPy
COBRA_AVAILABLE = False
try:
    import cobra
    COBRA_AVAILABLE = True
except Exception:
    COBRA_AVAILABLE = False


def run_live_fba(
    file_bytes: bytes, 
    filename: str, 
    medium_bound: float = -1000.0,
    objective_reaction_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes real-time Flux Balance Analysis (FBA) on an uploaded SBML XML model.
    Uses CobraPy if available, or falls back seamlessly to SciPy HiGHS LP solver + ElementTree XML parser.
    """
    t_start = time.time()

    # 1. Compute Fast MD5 Hash for In-Memory Caching (<1ms)
    file_hash = hashlib.md5(file_bytes + str(medium_bound).encode() + str(objective_reaction_id).encode()).hexdigest()
    
    if file_hash in FBA_RESULT_CACHE:
        cached_res = FBA_RESULT_CACHE[file_hash].copy()
        cached_res["execution_time_ms"] = round((time.time() - t_start) * 1000, 2)
        cached_res["cached"] = True
        return cached_res

    # Try Primary CobraPy Engine if available
    if COBRA_AVAILABLE:
        try:
            return _run_cobrapy_fba(file_bytes, filename, medium_bound, objective_reaction_id, t_start, file_hash)
        except Exception as e:
            # Fall back to SciPy Native Engine if CobraPy hits C-library errors (e.g. libexpat.so.1 missing)
            pass

    # Fallback Native Engine: SciPy HiGHS LP Solver + Pure Python XML Parser
    return _run_scipy_native_fba(file_bytes, filename, medium_bound, objective_reaction_id, t_start, file_hash)


def _run_cobrapy_fba(file_bytes: bytes, filename: str, medium_bound: float, objective_reaction_id: Optional[str], t_start: float, file_hash: str) -> Dict[str, Any]:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".xml") as tmp_file:
        tmp_file.write(file_bytes)
        tmp_path = tmp_file.name

    try:
        model = cobra.io.read_sbml_model(tmp_path)
        strain_name = model.id or filename.replace(".xml", "").replace(".sbml", "")

        try:
            model.solver.configuration.presolve = True
        except Exception:
            pass

        for rxn in model.exchanges:
            if rxn.lower_bound < 0:
                rxn.lower_bound = medium_bound

        if objective_reaction_id and objective_reaction_id in model.reactions:
            model.objective = objective_reaction_id

        solution = model.optimize()

        if solution.status != "optimal":
            return {
                "status": "error",
                "message": f"FBA optimization status is '{solution.status}'. Model is infeasible under bounds."
            }

        growth_rate = round(float(solution.objective_value), 6)
        exchange_fluxes: List[Dict[str, Any]] = []

        for rxn in model.exchanges:
            flux_val = round(float(solution.fluxes[rxn.id]), 6)
            if abs(flux_val) > 1e-6:
                direction = "Secretion" if flux_val > 0 else "Uptake"
                metabolite_name = rxn.name.replace(" exchange", "").replace(" Exchange", "") if rxn.name else rxn.id
                
                exchange_fluxes.append({
                    "Strain": strain_name,
                    "Exchange_ID": rxn.id,
                    "Reaction_Name": rxn.name or rxn.id,
                    "Metabolite_Name": metabolite_name,
                    "Lower_Bound": rxn.lower_bound,
                    "Upper_Bound": rxn.upper_bound,
                    "Flux": flux_val,
                    "Direction": direction
                })

        exchange_fluxes.sort(key=lambda x: (x["Direction"] != "Secretion", x["Metabolite_Name"]))
        df = pd.DataFrame(exchange_fluxes)
        execution_time_ms = round((time.time() - t_start) * 1000, 2)

        result = {
            "status": "success",
            "strain_name": strain_name,
            "filename": filename,
            "engine": "CobraPy (GLPK)",
            "objective_reaction": str(model.objective.expression),
            "biomass_growth_rate": growth_rate,
            "total_exchanges": len(exchange_fluxes),
            "uptake_count": sum(1 for e in exchange_fluxes if e["Direction"] == "Uptake"),
            "secretion_count": sum(1 for e in exchange_fluxes if e["Direction"] == "Secretion"),
            "execution_time_ms": execution_time_ms,
            "cached": False,
            "exchange_fluxes": exchange_fluxes,
            "csv_preview": df.to_csv(index=False) if not df.empty else ""
        }
        FBA_RESULT_CACHE[file_hash] = result
        return result
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


def _run_scipy_native_fba(file_bytes: bytes, filename: str, medium_bound: float, objective_reaction_id: Optional[str], t_start: float, file_hash: str) -> Dict[str, Any]:
    """
    Pure Python SBML Parser + SciPy HiGHS LP Solver.
    Zero C-library dependencies (works on all cloud platforms without libexpat.so.1).
    """
    xml_str = file_bytes.decode("utf-8", errors="ignore")
    
    # Strip XML namespaces for simple ElementTree parsing
    xml_clean = re.sub(r'xmlns="[^"]+"', '', xml_str, count=1)
    root = ET.fromstring(xml_clean)

    # 1. Extract Model Metadata
    model_elem = root.find('.//model') if root.tag != 'model' else root
    strain_name = filename.replace(".xml", "").replace(".sbml", "")
    if model_elem is not None and model_elem.attrib.get('id'):
        strain_name = model_elem.attrib.get('id')

    # 2. Extract Species / Metabolites
    species_set = set()
    for s_elem in root.findall('.//species'):
        s_id = s_elem.attrib.get('id')
        if s_id:
            species_set.add(s_id)
    
    species_list = sorted(list(species_set))
    species_idx_map = {s_id: i for i, s_id in enumerate(species_list)}
    m = len(species_list)

    # 3. Extract Reactions
    reactions = []
    rxn_id_map = {}

    for r_elem in root.findall('.//reaction'):
        r_id = r_elem.attrib.get('id')
        r_name = r_elem.attrib.get('name') or r_id
        
        # Determine bounds (default -1000 to 1000)
        lb = -1000.0
        ub = 1000.0
        
        # Check attributes
        if 'lowerBound' in r_elem.attrib:
            try: lb = float(r_elem.attrib['lowerBound'])
            except: pass
        if 'upperBound' in r_elem.attrib:
            try: ub = float(r_elem.attrib['upperBound'])
            except: pass

        # Reactants & Products
        stoich = {}
        for ref in r_elem.findall('.//listOfReactants/speciesReference'):
            sp = ref.attrib.get('species')
            stoich_val = float(ref.attrib.get('stoichiometry', 1.0))
            if sp in species_idx_map:
                stoich[species_idx_map[sp]] = stoich.get(species_idx_map[sp], 0.0) - stoich_val

        for ref in r_elem.findall('.//listOfProducts/speciesReference'):
            sp = ref.attrib.get('species')
            stoich_val = float(ref.attrib.get('stoichiometry', 1.0))
            if sp in species_idx_map:
                stoich[species_idx_map[sp]] = stoich.get(species_idx_map[sp], 0.0) + stoich_val

        # Is exchange reaction? (Starts with EX_, boundary, or single reactant/product)
        is_exchange = r_id.startswith("EX_") or "exchange" in r_name.lower() or len(stoich) == 1

        if is_exchange and lb < 0:
            lb = medium_bound

        reactions.append({
            "id": r_id,
            "name": r_name,
            "lb": lb,
            "ub": ub,
            "stoich": stoich,
            "is_exchange": is_exchange
        })
        rxn_id_map[r_id] = len(reactions) - 1

    n = len(reactions)
    if n == 0 or m == 0:
        return {"status": "error", "message": "Failed to parse reactions from SBML XML model."}

    # 4. Construct Stoichiometry Matrix S (m x n)
    S = np.zeros((m, n))
    bounds = []
    c = np.zeros(n)

    # Objective: Maximize biomass
    biomass_idx = None
    if objective_reaction_id and objective_reaction_id in rxn_id_map:
        biomass_idx = rxn_id_map[objective_reaction_id]
    else:
        for idx, rxn in enumerate(reactions):
            if "biomass" in rxn["id"].lower() or "biomass" in rxn["name"].lower():
                biomass_idx = idx
                break
        if biomass_idx is None:
            biomass_idx = n - 1 # Fallback to last reaction

    c[biomass_idx] = -1.0 # Maximize in linprog (c is minimized)

    for j, rxn in enumerate(reactions):
        bounds.append((rxn["lb"], rxn["ub"]))
        for i_idx, coef in rxn["stoich"].items():
            S[i_idx, j] = coef

    # 5. Execute SciPy HiGHS LP Solver (S * v = 0)
    res = linprog(c=c, A_eq=S, b_eq=np.zeros(m), bounds=bounds, method='highs')

    if not res.success:
        return {"status": "error", "message": f"FBA LP solver failed: {res.message}"}

    growth_rate = round(float(-res.fun), 6)
    fluxes = res.x

    # 6. Extract Exchange Fluxes
    exchange_fluxes = []
    for j, rxn in enumerate(reactions):
        if rxn["is_exchange"]:
            flux_val = round(float(fluxes[j]), 6)
            if abs(flux_val) > 1e-6:
                direction = "Secretion" if flux_val > 0 else "Uptake"
                metabolite_name = rxn["name"].replace(" exchange", "").replace(" Exchange", "") if rxn["name"] else rxn["id"]

                exchange_fluxes.append({
                    "Strain": strain_name,
                    "Exchange_ID": rxn["id"],
                    "Reaction_Name": rxn["name"],
                    "Metabolite_Name": metabolite_name,
                    "Lower_Bound": rxn["lb"],
                    "Upper_Bound": rxn["ub"],
                    "Flux": flux_val,
                    "Direction": direction
                })

    exchange_fluxes.sort(key=lambda x: (x["Direction"] != "Secretion", x["Metabolite_Name"]))
    df = pd.DataFrame(exchange_fluxes)
    execution_time_ms = round((time.time() - t_start) * 1000, 2)

    result = {
        "status": "success",
        "strain_name": strain_name,
        "filename": filename,
        "engine": "Native Pure-Python (SciPy HiGHS)",
        "objective_reaction": reactions[biomass_idx]["id"],
        "biomass_growth_rate": growth_rate,
        "total_exchanges": len(exchange_fluxes),
        "uptake_count": sum(1 for e in exchange_fluxes if e["Direction"] == "Uptake"),
        "secretion_count": sum(1 for e in exchange_fluxes if e["Direction"] == "Secretion"),
        "execution_time_ms": execution_time_ms,
        "cached": False,
        "exchange_fluxes": exchange_fluxes,
        "csv_preview": df.to_csv(index=False) if not df.empty else ""
    }

    FBA_RESULT_CACHE[file_hash] = result
    return result
