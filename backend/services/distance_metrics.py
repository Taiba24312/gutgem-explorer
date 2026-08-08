import numpy as np
from scipy.spatial.distance import pdist, squareform
from scipy.stats import pearsonr, spearmanr, kendalltau

def compute_pairwise_distance(matrix: np.ndarray, metric: str = "jaccard", is_binary: bool = True) -> np.ndarray:
    """
    Computes a square pairwise distance matrix for given 2D NumPy array (strains x features).
    """
    metric = metric.lower()

    if is_binary:
        # SciPy binary metrics
        valid_binary_metrics = ["jaccard", "dice", "hamming", "russellrao", "sokalmichener", "rogerstanimoto"]
        if metric not in valid_binary_metrics:
            metric = "jaccard"
        
        # Ensure binary matrix boolean/uint8
        bool_mat = matrix != 0
        dist_vec = pdist(bool_mat, metric=metric)
        return squareform(dist_vec)

    else:
        # Continuous flux matrix metrics
        if metric in ["braycurtis", "cityblock", "euclidean", "canberra", "cosine", "chebyshev", "minkowski"]:
            # Convert negative uptake fluxes to positive magnitudes if using Bray-Curtis
            if metric == "braycurtis":
                matrix = np.abs(matrix)
            dist_vec = pdist(matrix, metric=metric)
            return squareform(dist_vec)
        
        elif metric in ["pearson", "spearman", "kendall"]:
            n_strains = matrix.shape[0]
            dist_mat = np.zeros((n_strains, n_strains))
            for i in range(n_strains):
                for j in range(i, n_strains):
                    if i == j:
                        dist_mat[i, j] = 0.0
                    else:
                        u, v = matrix[i], matrix[j]
                        if metric == "pearson":
                            r, _ = pearsonr(u, v)
                        elif metric == "spearman":
                            r, _ = spearmanr(u, v)
                        elif metric == "kendall":
                            r, _ = kendalltau(u, v)
                        
                        r_val = 0.0 if np.isnan(r) else r
                        dist = 1.0 - r_val  # Convert correlation to distance in [0, 2]
                        dist_mat[i, j] = dist
                        dist_mat[j, i] = dist
            return dist_mat
        else:
            dist_vec = pdist(matrix, metric="euclidean")
            return squareform(dist_vec)
