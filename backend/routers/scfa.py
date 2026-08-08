from fastapi import APIRouter, HTTPException, Query
from backend.database import execute_query

router = APIRouter(prefix="/scfa", tags=["SCFA Explorer"])

@router.get("/summary")
def get_scfa_summary():
    """
    Queries scfa_summary table.
    """
    summary = execute_query("SELECT * FROM scfa_summary")
    return {"count": len(summary), "scfa_summary": summary}

@router.get("/{name}/strains")
def get_scfa_strains(name: str, role: str = "all"):
    """
    Queries exchange_fluxes table for specified SCFA.
    """
    if role == "producers":
        sql = "SELECT strain_name, direction, flux FROM exchange_fluxes WHERE metabolite_name = ? AND direction = 'Secretion' ORDER BY flux DESC"
        params = (name,)
    elif role == "consumers":
        sql = "SELECT strain_name, direction, flux FROM exchange_fluxes WHERE metabolite_name = ? AND direction = 'Uptake' ORDER BY flux ASC"
        params = (name,)
    else:
        sql = "SELECT strain_name, direction, flux FROM exchange_fluxes WHERE metabolite_name = ? ORDER BY strain_name"
        params = (name,)

    strains = execute_query(sql, params)
    return {"scfa_name": name, "role_filter": role, "count": len(strains), "strains": strains}
