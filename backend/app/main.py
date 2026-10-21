from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.config import settings
from backend.app.seed import seed_database
from backend.app.api.health import router as health_router
from backend.app.api.dashboard import router as dashboard_router
from backend.app.api.energy import router as energy_router
from backend.app.api.forecast import router as forecast_router
from backend.app.api.anomalies import router as anomalies_router
from backend.app.api.bills import router as bills_router
from backend.app.api.insights import router as insights_router
from backend.app.api.model import router as model_router
from backend.app.api.settings import router as settings_router

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Verify database and seed initial data if required
    try:
        seed_database()
    except Exception as e:
        print(f"Startup database check warning: {e}")
    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.APP_NAME,
    description="Smart Household Electricity Consumption Prediction & Anomaly Analytics Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(energy_router)
app.include_router(forecast_router)
app.include_router(anomalies_router)
app.include_router(bills_router)
app.include_router(insights_router)
app.include_router(model_router)
app.include_router(settings_router)


from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Static Frontend SPA Serving (if built)
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # Don't intercept API or docs routes
        if full_path.startswith("api") or full_path.startswith("docs") or full_path.startswith("redoc") or full_path == "openapi.json":
            return None
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/", tags=["Root"])
    def root():
        return {
            "message": f"Welcome to {settings.APP_NAME} API",
            "version": "1.0.0",
            "documentation": "/docs",
            "health": "/api/health",
        }
