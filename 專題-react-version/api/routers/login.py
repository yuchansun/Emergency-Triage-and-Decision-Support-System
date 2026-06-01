from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_conn

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str
    password: str


def normalize_role(raw_role: str) -> str:
    r = (raw_role or "").strip().lower()
    if r in ("admin", "administrator", "管理員"):
        return "admin"
    return "user"


@router.post("/login")
async def login(request: LoginRequest):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # 改為讀 staff.role，不要寫死 'nurse'
            sql = """
                SELECT nurse_id, name, role, status
                FROM staff
                WHERE username = %s AND password = %s
                LIMIT 1
            """
            cur.execute(sql, (request.username, request.password))
            user = cur.fetchone()

            if not user:
                raise HTTPException(status_code=401, detail="帳號或密碼錯誤")

            if isinstance(user, dict):
                nurse_id = user.get("nurse_id")
                name = user.get("name")
                role = normalize_role(user.get("role"))
                status = (user.get("status") or "").strip()
            else:
                nurse_id = user[0]
                name = user[1]
                role = normalize_role(user[2] if len(user) > 2 else "")
                status = str(user[3] if len(user) > 3 else "").strip()

            if status == "停用":
                raise HTTPException(status_code=403, detail="此帳號已停用，請聯絡管理員")

            res_user = {
                "nurseId": str(nurse_id) if nurse_id is not None else "",
                "name": name or "",
                "role": role,
            }
            return {"success": True, "user": res_user}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()