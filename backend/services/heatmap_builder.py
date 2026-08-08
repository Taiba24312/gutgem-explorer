import numpy as np
from typing import List, Dict, Any
from backend.database import get_db_connection

def extract_heatmap_submatrix(
    matrix_table: str, 
    strains: List[str] = None, 
    metabolites: List[str] = None,
    limit_strains: int = 50,
    limit_metabolites: int = 20
) -> Dict[str, Any]:
    """
    Extracts 2D grid matrix from SQLite for binary_matrix, uptake_matrix, secretion_matrix, or flux_matrix.
    """
    allowed_tables = ["binary_matrix", "uptake_matrix", "secretion_matrix", "flux_matrix"]
    if matrix_table not in allowed_tables:
        matrix_table = "binary_matrix"

    value_column = "is_active" if matrix_table == "binary_matrix" else "flux_value"

    with get_db_connection() as conn:
        cursor = conn.cursor()

        # Target Strains
        if not strains:
            cursor.execute(f"SELECT DISTINCT strain_name FROM {matrix_table} LIMIT ?", (limit_strains,))
            strains = [r[0] for r in cursor.fetchall()]

        # Target Metabolites
        if not metabolites:
            if matrix_table == "binary_matrix":
                cursor.execute(f"SELECT metabolite_name, COUNT(*) as cnt FROM {matrix_table} GROUP BY metabolite_name ORDER BY cnt DESC LIMIT ?", (limit_metabolites,))
            else:
                cursor.execute(f"SELECT metabolite_name, COUNT(*) as cnt FROM {matrix_table} GROUP BY metabolite_name ORDER BY cnt DESC LIMIT ?", (limit_metabolites,))
            metabolites = [r[0] for r in cursor.fetchall()]

        # Extract values
        placeholders_s = ",".join(["?"] * len(strains))
        placeholders_m = ",".join(["?"] * len(metabolites))

        query = f"""
            SELECT strain_name, metabolite_name, {value_column} 
            FROM {matrix_table} 
            WHERE strain_name IN ({placeholders_s}) AND metabolite_name IN ({placeholders_m})
        """
        params = strains + metabolites
        cursor.execute(query, params)
        rows = cursor.fetchall()

        # Build 2D lookup map
        lookup = {(r[0], r[1]): r[2] for r in rows}

        grid = []
        for s in strains:
            row_vals = []
            for m in metabolites:
                row_vals.append(lookup.get((s, m), 0.0))
            grid.append(row_vals)

        return {
            "matrix_type": matrix_table,
            "strains": strains,
            "metabolites": metabolites,
            "grid": grid
        }
