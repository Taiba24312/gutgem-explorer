from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from typing import Optional
import json
import pandas as pd
from backend.services.fba_engine import run_live_fba

router = APIRouter(prefix="/fba", tags=["Live FBA Simulation"])

@router.post("/simulate")
async def simulate_sbml_model(
    file: UploadFile = File(...),
    medium_bound: float = Form(-1000.0),
    objective_reaction_id: Optional[str] = Form(None)
):
    """
    Accepts an uploaded SBML XML metabolic model (.xml, .sbml),
    executes real-time FBA using CobraPy, and returns growth rate & exchange reactions.
    """
    filename = file.filename or "model.xml"
    ext = filename.split(".").pop().lower() if "." in filename else ""
    
    if not (filename.endswith(".xml") or filename.endswith(".sbml") or ext in ["xml", "sbml"]):
        raise HTTPException(status_code=400, detail="Invalid file format. Please upload an SBML XML file (.xml or .sbml).")

    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        result = run_live_fba(
            file_bytes=content,
            filename=filename,
            medium_bound=medium_bound,
            objective_reaction_id=objective_reaction_id
        )

        if result.get("status") == "error":
            raise HTTPException(status_code=422, detail=result.get("message", "FBA simulation failed."))

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"FBA Simulation Error: {str(e)}")

@router.post("/download-csv")
async def download_fba_csv(data: dict):
    """
    Generates and streams a downloadable CSV file from FBA simulation exchange fluxes.
    """
    fluxes = data.get("exchange_fluxes", [])
    filename = data.get("filename", "fba_exchange_fluxes.csv").replace(".xml", "").replace(".sbml", "") + "_exchange_fluxes.csv"
    
    if not fluxes:
        raise HTTPException(status_code=400, detail="No exchange flux data provided.")

    df = pd.DataFrame(fluxes)
    csv_content = df.to_csv(index=False)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
