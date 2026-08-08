from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from backend.services.heatmap_builder import extract_heatmap_submatrix

router = APIRouter(prefix="/heatmap", tags=["Heatmap"])

class HeatmapRequest(BaseModel):
    matrix_table: str = "binary_matrix"
    strains: Optional[List[str]] = None
    metabolites: Optional[List[str]] = None
    limit_strains: int = 50
    limit_metabolites: int = 20

@router.post("/matrix")
def get_heatmap_matrix(req: HeatmapRequest):
    """
    Queries binary_matrix, uptake_matrix, secretion_matrix, or flux_matrix tables.
    """
    res = extract_heatmap_submatrix(
        matrix_table=req.matrix_table,
        strains=req.strains,
        metabolites=req.metabolites,
        limit_strains=req.limit_strains,
        limit_metabolites=req.limit_metabolites
    )
    return res
