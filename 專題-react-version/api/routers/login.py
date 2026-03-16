from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_conn  

router = APIRouter(prefix="/auth", tags=["auth"])

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/login")
async def login(request: LoginRequest):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 查詢護理人員帳號密碼
            sql = "SELECT nurse_id, name, role FROM staff WHERE username = %s AND password = %s"
            cur.execute(sql, (request.username, request.password))
            user = cur.fetchone()
            
            # 處理回傳格式 (兼容 dict 或 tuple)
            if user:
                if isinstance(user, dict):
                    res_user = {
                        "nurseId": user.get("nurse_id"),
                        "name": user.get("name"),
                        "role": user.get("role")
                    }
                else:
                    res_user = {
                        "nurseId": user[0],
                        "name": user[1],
                        "role": user[2]
                    }
                return {"success": True, "user": res_user}
            else:
                raise HTTPException(status_code=401, detail="帳號或密碼錯誤")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()