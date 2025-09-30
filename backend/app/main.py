from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.health import router as health_router
from app.routers.students import router as students_router
from app.routers.runs import router as runs_router
from app.routers.downloads import router as downloads_router
from app.routers.internships_company import router as internships_router
from app.routers.auth import router as auth_router
from app.routers.dashboard import router as dashboard_router
from app.routers.search import router as search_router  
from app.routers.preferences import router as preferences_router
from app.routers.internship_details import router as internship_details_router
from app.routers.dashboard_company import router as dashboard_company_router
from app.routers.allocation_router import router as allocation_router
from app.routers.logs import router as logs_router
from app.routers.ensemble_allocation_router import router as ensemble_allocation_router
from app.routers.nlp_router import router as nlp_router
# Register routers (add this line)
app = FastAPI(title="PM Internship Allocation API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(students_router)
app.include_router(runs_router)
app.include_router(downloads_router)
app.include_router(internships_router)
app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(search_router)  
app.include_router(preferences_router)
app.include_router(internship_details_router)
app.include_router(dashboard_company_router)  
app.include_router(allocation_router)
app.include_router(logs_router)  
app.include_router(ensemble_allocation_router) 
app.include_router(nlp_router)  