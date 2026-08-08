import os
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.config import settings
from backend.routers import status, strain, metabolite, scfa, compare, heatmap, analytics, downloads

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="GutGEM Explorer v1.0 Dual-Mode Computational Platform API"
)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prevent static file caching in development/browser
@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response: Response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Include Routers with /api/v1 prefix
app.include_router(status.router, prefix=settings.API_PREFIX)
app.include_router(strain.router, prefix=settings.API_PREFIX)
app.include_router(metabolite.router, prefix=settings.API_PREFIX)
app.include_router(scfa.router, prefix=settings.API_PREFIX)
app.include_router(compare.router, prefix=settings.API_PREFIX)
app.include_router(heatmap.router, prefix=settings.API_PREFIX)
app.include_router(analytics.router, prefix=settings.API_PREFIX)
app.include_router(downloads.router, prefix=settings.API_PREFIX)

# Mount root directory for static web files (index.html, styles.css, app.js, data/)
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.mount("/", StaticFiles(directory=PROJECT_ROOT, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, reload=True)
