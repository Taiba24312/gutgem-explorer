from fastapi import APIRouter
import sqlite3
import os
from backend.config import settings

router = APIRouter(tags=["Status"])

@router.get("/status")
@router.get("/health")
def get_system_status():
    db_exists = os.path.exists(settings.DATABASE_PATH)
    db_ok = False
    record_count = 0

    if db_exists:
        try:
            conn = sqlite3.connect(settings.DATABASE_PATH)
            cur = conn.cursor()
            cur.execute("SELECT COUNT(*) FROM exchange_fluxes")
            record_count = cur.fetchone()[0]
            conn.close()
            db_ok = True
        except Exception:
            db_ok = False

    return {
        "status": "ok" if db_ok else "degraded",
        "mode": "live" if db_ok else "static",
        "backend": "FastAPI v1.0",
        "database_connected": db_ok,
        "total_flux_records": record_count
    }
