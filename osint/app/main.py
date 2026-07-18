from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.recon import router as recon_router
from app.entity import router as entity_router
from app.intel import router as intel_router
from app.sar import router as sar_router
from app.imagery import router as imagery_router
from app.radio import router as radio_router
from app.cctv import router as cctv_router

app = FastAPI(title="GOD-EYE OSINT Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recon_router)
app.include_router(entity_router)
app.include_router(intel_router)
app.include_router(sar_router)
app.include_router(imagery_router)
app.include_router(radio_router)
app.include_router(cctv_router)


@app.get("/osint/health")
async def health():
    return {"status": "ok", "service": "god-eye-osint"}
