from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
import os
from backend.config import BASE_DIR

router = APIRouter(prefix="/downloads", tags=["Downloads"])

DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")

ALLOWED_FILES = {
    "master": "exchange_fluxes_master.csv",
    "strains": "strain_statistics.csv",
    "metabolites": "metabolite_statistics.csv",
    "scfa": "scfa_matrix.csv",
    "binary": "binary_matrix.csv",
    "uptake": "uptake_matrix.csv",
    "secretion": "secretion_matrix.csv",
    "flux": "uptake_secretion_flux_matrix.csv"
}

@router.get("/{file_key}")
def download_csv_dataset(file_key: str):
    """
    Streams requested existing processed CSV dataset.
    """
    filename = ALLOWED_FILES.get(file_key.lower())
    if not filename:
        raise HTTPException(status_code=404, detail="Dataset file not found")

    filepath = os.path.join(DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File does not exist on disk")

    return FileResponse(filepath, media_type="text/csv", filename=filename)
