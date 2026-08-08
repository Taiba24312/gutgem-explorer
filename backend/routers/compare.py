import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from backend.database import execute_query
from scipy.spatial.distance import cdist
from scipy.stats import pearsonr, spearmanr, kendalltau

router = APIRouter(prefix="/compare", tags=["Compare Strains"])

class PairCompareRequest(BaseModel):
    strain_a: str
    strain_b: str
    metric: str = "jaccard"

class GroupCompareRequest(BaseModel):
    group_a: List[str]
    group_b: List[str]
    metric: str = "braycurtis"

def compute_metric_between_vectors(vec_a: np.ndarray, vec_b: np.ndarray, metric: str) -> float:
    metric = metric.lower()
    
    # Binary metrics
    if metric == "jaccard":
        u = (vec_a != 0)
        v = (vec_b != 0)
        intersection = np.logical_and(u, v).sum()
        union = np.logical_or(u, v).sum()
        return float(1.0 - (intersection / union)) if union > 0 else 0.0
    
    elif metric == "jaccard_similarity":
        u = (vec_a != 0)
        v = (vec_b != 0)
        intersection = np.logical_and(u, v).sum()
        union = np.logical_or(u, v).sum()
        return float(intersection / union) if union > 0 else 0.0

    elif metric == "dice":
        u = (vec_a != 0)
        v = (vec_b != 0)
        intersection = np.logical_and(u, v).sum()
        total = u.sum() + v.sum()
        return float(2.0 * intersection / total) if total > 0 else 0.0

    elif metric == "hamming":
        u = (vec_a != 0)
        v = (vec_b != 0)
        return float(np.mean(u != v))

    # Continuous flux metrics
    elif metric == "braycurtis":
        abs_a = np.abs(vec_a)
        abs_b = np.abs(vec_b)
        tot = np.sum(abs_a + abs_b)
        return float(np.sum(np.abs(abs_a - abs_b)) / tot) if tot > 0 else 0.0

    elif metric == "manhattan":
        return float(np.sum(np.abs(vec_a - vec_b)))

    elif metric == "euclidean":
        return float(np.sqrt(np.sum((vec_a - vec_b) ** 2)))

    elif metric == "canberra":
        denom = np.abs(vec_a) + np.abs(vec_b)
        mask = denom > 0
        return float(np.sum(np.abs(vec_a[mask] - vec_b[mask]) / denom[mask])) if np.any(mask) else 0.0

    elif metric == "cosine":
        norm_a = np.linalg.norm(vec_a)
        norm_b = np.linalg.norm(vec_b)
        if norm_a == 0 or norm_b == 0:
            return 1.0
        return float(1.0 - (np.dot(vec_a, vec_b) / (norm_a * norm_b)))

    elif metric == "chebyshev":
        return float(np.max(np.abs(vec_a - vec_b)))

    elif metric == "pearson":
        if np.all(vec_a == vec_a[0]) or np.all(vec_b == vec_b[0]):
            return 1.0
        r, _ = pearsonr(vec_a, vec_b)
        r_val = 0.0 if np.isnan(r) else r
        return float(1.0 - r_val)

    elif metric == "spearman":
        if np.all(vec_a == vec_a[0]) or np.all(vec_b == vec_b[0]):
            return 1.0
        r, _ = spearmanr(vec_a, vec_b)
        r_val = 0.0 if np.isnan(r) else r
        return float(1.0 - r_val)

    else:
        # Default Euclidean
        return float(np.sqrt(np.sum((vec_a - vec_b) ** 2)))


@router.post("")
def compare_strain_pair(req: PairCompareRequest):
    """
    Pairwise 1-vs-1 comparison with user-selected distance metric.
    """
    rxns_a = execute_query("SELECT metabolite_name, flux, direction FROM exchange_fluxes WHERE strain_name = ?", (req.strain_a,))
    rxns_b = execute_query("SELECT metabolite_name, flux, direction FROM exchange_fluxes WHERE strain_name = ?", (req.strain_b,))

    if not rxns_a or not rxns_b:
        raise HTTPException(status_code=404, detail="One or both strains not found")

    uptake_a = set(r["metabolite_name"] for r in rxns_a if r["direction"] == "Uptake")
    uptake_b = set(r["metabolite_name"] for r in rxns_b if r["direction"] == "Uptake")

    sec_a = set(r["metabolite_name"] for r in rxns_a if r["direction"] == "Secretion")
    sec_b = set(r["metabolite_name"] for r in rxns_b if r["direction"] == "Secretion")

    map_a = {r["metabolite_name"]: float(r["flux"]) for r in rxns_a}
    map_b = {r["metabolite_name"]: float(r["flux"]) for r in rxns_b}
    
    all_metabs = sorted(list(set(map_a.keys()).union(set(map_b.keys()))))
    vec_a = np.array([map_a.get(m, 0.0) for m in all_metabs])
    vec_b = np.array([map_b.get(m, 0.0) for m in all_metabs])

    selected_dist = compute_metric_between_vectors(vec_a, vec_b, req.metric)

    return {
        "strain_a": req.strain_a,
        "strain_b": req.strain_b,
        "selected_metric": req.metric,
        "calculated_distance": round(selected_dist, 4),
        "metrics_summary": {
            "jaccard_similarity": round(compute_metric_between_vectors(vec_a, vec_b, "jaccard_similarity"), 4),
            "bray_curtis": round(compute_metric_between_vectors(vec_a, vec_b, "braycurtis"), 4),
            "manhattan_distance": round(compute_metric_between_vectors(vec_a, vec_b, "manhattan"), 2),
            "euclidean_distance": round(compute_metric_between_vectors(vec_a, vec_b, "euclidean"), 2),
            "cosine_distance": round(compute_metric_between_vectors(vec_a, vec_b, "cosine"), 4),
            "canberra_distance": round(compute_metric_between_vectors(vec_a, vec_b, "canberra"), 4)
        },
        "common_uptake": sorted(list(uptake_a.intersection(uptake_b))),
        "common_secretion": sorted(list(sec_a.intersection(sec_b)))
    }


@router.post("/group")
def compare_strain_groups(req: GroupCompareRequest):
    """
    Multi-strain comparison: Group A (5-6 strains) vs Group B (5-6 strains).
    Computes inter-group pairwise matrix and summary statistics (Mean, Min, Max distance).
    """
    all_strains = list(set(req.group_a + req.group_b))
    if not all_strains:
        raise HTTPException(status_code=400, detail="Groups must contain at least 1 strain each")

    placeholders = ",".join(["?"] * len(all_strains))
    query = f"SELECT strain_name, metabolite_name, flux FROM exchange_fluxes WHERE strain_name IN ({placeholders})"
    rows = execute_query(query, tuple(all_strains))

    # Build strain -> {metabolite: flux} map
    strain_maps: Dict[str, Dict[str, float]] = {s: {} for s in all_strains}
    for r in rows:
        strain_maps[r["strain_name"]][r["metabolite_name"]] = float(r["flux"])

    # Target metabolites union across selected strains
    metab_set = set()
    for s in all_strains:
        metab_set.update(strain_maps[s].keys())
    all_metabs = sorted(list(metab_set))

    # Construct vectors
    vectors_a = []
    for s in req.group_a:
        vec = [strain_maps[s].get(m, 0.0) for m in all_metabs]
        vectors_a.append(vec)

    vectors_b = []
    for s in req.group_b:
        vec = [strain_maps[s].get(m, 0.0) for m in all_metabs]
        vectors_b.append(vec)

    arr_a = np.array(vectors_a)
    arr_b = np.array(vectors_b)

    # Compute inter-group pairwise matrix
    matrix = []
    all_dists = []
    for i, sA in enumerate(req.group_a):
        row = []
        for j, sB in enumerate(req.group_b):
            d = compute_metric_between_vectors(arr_a[i], arr_b[j], req.metric)
            row.append(round(d, 4))
            all_dists.append(d)
        matrix.append(row)

    mean_dist = float(np.mean(all_dists)) if all_dists else 0.0
    min_dist = float(np.min(all_dists)) if all_dists else 0.0
    max_dist = float(np.max(all_dists)) if all_dists else 0.0

    return {
        "selected_metric": req.metric,
        "group_a": req.group_a,
        "group_b": req.group_b,
        "mean_distance": round(mean_dist, 4),
        "min_distance": round(min_dist, 4),
        "max_distance": round(max_dist, 4),
        "pairwise_matrix": matrix
    }
