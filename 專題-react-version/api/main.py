from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.counts import router as counts_router
from routers.triagehierarchy import router as triage_router
from routers.triagesave import router as triage_save_router  # ← 新增

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "FastAPI is running"}

app.include_router(counts_router)
app.include_router(triage_router)
app.include_router(triage_save_router)  # ← 新增