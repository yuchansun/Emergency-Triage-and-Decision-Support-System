from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.counts import router as counts_router
from routers.triagehierarchy import router as triage_router
from routers.patients import router as patients_router
# 1. 補上這行：引入 login router
from routers.login import router as login_router 

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. 註冊 login router
# 注意：這裡「不要」加 prefix="/api"，除非你的前端呼叫的是 /api/login
app.include_router(login_router) 

# 其他有 prefix 的 router
app.include_router(patients_router, prefix="/api")
app.include_router(triage_router, prefix="/api")