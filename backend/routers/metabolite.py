from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.database import execute_query, execute_single

router = APIRouter(prefix="/metabolites", tags=["Metabolites"])

@router.get("")
def list_metabolites(query: Optional[str] = None, limit: int = 100, offset: int = 0):
    """
    Queries metabolites table.
    """
    if query:
        sql = "SELECT * FROM metabolites WHERE metabolite_name LIKE ? ORDER BY total_exchange DESC LIMIT ? OFFSET ?"
        params = (f"%{query}%", limit, offset)
    else:
        sql = "SELECT * FROM metabolites ORDER BY total_exchange DESC LIMIT ? OFFSET ?"
        params = (limit, offset)
    
    metabolites = execute_query(sql, params)
    return {"count": len(metabolites), "metabolites": metabolites}

@router.get("/{name}")
def get_metabolite_profile(name: str):
    """
    Queries metabolites and exchange_fluxes tables for specified metabolite.
    """
    meta = execute_single("SELECT * FROM metabolites WHERE metabolite_name = ?", (name,))
    if not meta:
        raise HTTPException(status_code=404, detail=f"Metabolite '{name}' not found")

    uptake_strains = execute_query(
        "SELECT strain_name, flux FROM exchange_fluxes WHERE metabolite_name = ? AND direction = 'Uptake' ORDER BY strain_name",
        (name,)
    )
    secretion_strains = execute_query(
        "SELECT strain_name, flux FROM exchange_fluxes WHERE metabolite_name = ? AND direction = 'Secretion' ORDER BY strain_name",
        (name,)
    )

    return {
        "metabolite_name": name,
        "metadata": meta,
        "uptake_strains": uptake_strains,
        "secretion_strains": secretion_strains
    }
