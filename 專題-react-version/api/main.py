from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.counts import router as counts_router
from routers.triagehierarchy import router as triage_router
from routers.triagesave import router as triage_save_router 
from routers.patients import router as patient_router
from routers.login import router as login_router  # 1. 新增導入
from routers.symptoms import router as symptoms_router  # 2. 新增導入
from routers.triage_report import router as triage_report_router

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

app.include_router(login_router)
app.include_router(patient_router)
app.include_router(counts_router)
app.include_router(triage_router)
app.include_router(triage_save_router)
app.include_router(symptoms_router)

  # 2. 註冊登入路由
app.include_router(triage_report_router)  # 2. 註冊登入路由

# 如果你按照上面的 prefix 設定，API 路徑會是: /auth/login