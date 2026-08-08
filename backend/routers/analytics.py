from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from backend.services.heatmap_builder import extract_heatmap_submatrix
from backend.services.distance_metrics import compute_pairwise_distance
from backend.services.clustering import compute_hierarchical_clustering

router = APIRouter(prefix="/analytics", tags=["Advanced Analytics"])

class AnalyticsRequest(BaseModel):
    matrix_table: str = "binary_matrix"
    metric: str = "jaccard"
    linkage_method: Optional[str] = "average"
    strains: Optional[List[str]] = None
    metabolites: Optional[List[str]] = None
    limit_strains: int = 50
    limit_metabolites: int = 20

@router.post("/distance")
def get_distance_matrix(req: AnalyticsRequest):
    """
    Extracts matrix from SQLite (binary_matrix or flux_matrix) and computes pairwise distance.
    """
    submatrix_res = extract_heatmap_submatrix(
        matrix_table=req.matrix_table,
        strains=req.strains,
        metabolites=req.metabolites,
        limit_strains=req.limit_strains,
        limit_metabolites=req.limit_metabolites
    )
    
    strains = submatrix_res["strains"]
    grid_arr = np.array(submatrix_res["grid"])

    is_binary = (req.matrix_table == "binary_matrix")
    dist_matrix = compute_pairwise_distance(grid_arr, metric=req.metric, is_binary=is_binary)

    return {
        "matrix_table": req.matrix_table,
        "metric": req.metric,
        "strains": strains,
        "distance_matrix": dist_matrix.tolist()
    }

@router.post("/cluster")
def get_hierarchical_cluster(req: AnalyticsRequest):
    """
    Computes hierarchical clustering dendrogram on calculated distance matrix.
    """
    submatrix_res = extract_heatmap_submatrix(
        matrix_table=req.matrix_table,
        strains=req.strains,
        metabolites=req.metabolites,
        limit_strains=req.limit_strains,
        limit_metabolites=req.limit_metabolites
    )
    
    strains = submatrix_res["strains"]
    grid_arr = np.array(submatrix_res["grid"])

    is_binary = (req.matrix_table == "binary_matrix")
    dist_matrix = compute_pairwise_distance(grid_arr, metric=req.metric, is_binary=is_binary)
    
    cluster_res = compute_hierarchical_clustering(
        dist_matrix, 
        labels=strains, 
        method=req.linkage_method or "average"
    )

    return {
        "matrix_table": req.matrix_table,
        "metric": req.metric,
        "linkage_method": req.linkage_method,
        "clustering": cluster_res
    }
