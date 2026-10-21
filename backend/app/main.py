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
from backend.app.api.buildings import router as buildings_router
from backend.app.api.advanced_analytics import router as advanced_analytics_router
from backend.app.api.import_data import router as import_router
from backend.app.api.budget import router as budget_router
from backend.app.api.simulator import router as simulator_router
from backend.app.api.carbon import router as carbon_router
from backend.app.api.circuits import router as circuits_router
from backend.app.api.notifications import router as notifications_router
from backend.app.api.reports import router as reports_router
from backend.app.api.audit import router as audit_router

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
    description="EcoWatt ML — Advanced Household & Institutional Energy Intelligence Platform",
    version="2.0.0",
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

# Register Core & Feature Routers
app.include_router(health_router)
app.include_router(dashboard_router)
app.include_router(energy_router)
app.include_router(forecast_router)
app.include_router(anomalies_router)
app.include_router(bills_router)
app.include_router(insights_router)
app.include_router(model_router)
app.include_router(settings_router)
app.include_router(buildings_router)
app.include_router(advanced_analytics_router)
app.include_router(import_router)
app.include_router(budget_router)
app.include_router(simulator_router)
app.include_router(carbon_router)
app.include_router(circuits_router)
app.include_router(notifications_router)
app.include_router(reports_router)
app.include_router(audit_router)


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
            "message": f"Welcome to {settings.APP_NAME} API v2.0",
            "version": "2.0.0",
            "documentation": "/docs",
            "health": "/api/health",
        }
