import numpy as np
from scipy.cluster.hierarchy import linkage, dendrogram
from scipy.spatial.distance import squareform
from typing import Dict, Any, List

def compute_hierarchical_clustering(
    dist_matrix: np.ndarray, 
    labels: List[str], 
    method: str = "ward"
) -> Dict[str, Any]:
    """
    Computes hierarchical clustering linkage and dendrogram dictionary.
    Methods: 'average', 'complete', 'ward', 'single'.
    """
    valid_methods = ["average", "complete", "ward", "single"]
    if method.lower() not in valid_methods:
        method = "average"

    # Condensed distance matrix required for SciPy linkage
    condensed_dist = squareform(dist_matrix, checks=False)

    # Compute linkage matrix
    Z = linkage(condensed_dist, method=method.lower())

    # Generate dendrogram leaf structure
    dend = dendrogram(Z, labels=labels, no_plot=True)

    return {
        "icoord": dend["icoord"],
        "dcoord": dend["dcoord"],
        "ivl": dend["ivl"],
        "leaves": dend["leaves"],
        "method": method
    }
