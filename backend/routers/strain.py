from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from backend.database import execute_query, execute_single

router = APIRouter(prefix="/strains", tags=["Strains"])

@router.get("")
def list_strains(query: Optional[str] = None, limit: int = 100, offset: int = 0):
    """
    Queries strains table.
    """
    if query:
        sql = "SELECT * FROM strains WHERE strain_name LIKE ? ORDER BY strain_name LIMIT ? OFFSET ?"
        params = (f"%{query}%", limit, offset)
    else:
        sql = "SELECT * FROM strains ORDER BY strain_name LIMIT ? OFFSET ?"
        params = (limit, offset)
    
    strains = execute_query(sql, params)
    return {"count": len(strains), "strains": strains}

@router.get("/{name}")
def get_strain_profile(name: str):
    """
    Queries strains and exchange_fluxes tables for specified strain.
    """
    meta = execute_single("SELECT * FROM strains WHERE strain_name = ?", (name,))
    if not meta:
        raise HTTPException(status_code=404, detail=f"Strain '{name}' not found")

    uptake_rxns = execute_query(
        "SELECT exchange_id, reaction_name, metabolite_name, flux FROM exchange_fluxes WHERE strain_name = ? AND direction = 'Uptake' ORDER BY metabolite_name",
        (name,)
    )
    secretion_rxns = execute_query(
        "SELECT exchange_id, reaction_name, metabolite_name, flux FROM exchange_fluxes WHERE strain_name = ? AND direction = 'Secretion' ORDER BY metabolite_name",
        (name,)
    )

    return {
        "strain_name": name,
        "metadata": meta,
        "uptake": uptake_rxns,
        "secretion": secretion_rxns
    }
