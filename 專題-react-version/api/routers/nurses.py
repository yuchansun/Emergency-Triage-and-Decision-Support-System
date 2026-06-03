from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_conn

router = APIRouter(prefix="/nurses", tags=["nurses"])


def normalize_triage_level(value):
    if value is None:
        return 5
    try:
        level = int(value)
    except (TypeError, ValueError):
        return 5
    if level <= 0:
        return 1
    if level >= 5:
        return 5
    return level


class NurseCreateRequest(BaseModel):
    nurseId: Optional[str] = None
    name: str
    role: str = "護理師"
    department: str = "急診"
    shift: str = "白班"
    status: str = "在職"
    phone: Optional[str] = None
    email: Optional[str] = None
    hireDate: Optional[str] = None
    licenseNo: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None


class NurseActivationRequest(BaseModel):
    active: bool


@router.get("")
async def get_nurses():
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    s.nurse_id,
                    s.name,
                    s.role,
                    s.department,
                    s.shift_type,
                    s.status,
                    s.phone,
                    s.email,
                    s.hire_date,
                    s.license_number,
                    COALESCE(COUNT(t.triage_id), 0) AS triage_count
                FROM staff s
                LEFT JOIN triage_record t ON t.nurse_id = s.nurse_id
                GROUP BY
                    s.nurse_id, s.name, s.role, s.department, s.shift_type, s.status,
                    s.phone, s.email, s.hire_date, s.license_number
                ORDER BY s.nurse_id DESC
                """
            )
            rows = cur.fetchall() or []

            data = []
            for r in rows:
                row = r if isinstance(r, dict) else {}
                status = (row.get("status") or "").strip()
                data.append({
                    "nurseId": str(row.get("nurse_id") or ""),
                    "name": row.get("name") or "",
                    "role": row.get("role") or "",
                    "department": row.get("department") or "",
                    "shift": row.get("shift_type") or "",
                    "status": status,
                    "isActive": status != "停用",
                    "phone": row.get("phone") or "",
                    "email": row.get("email") or "",
                    "hireDate": str(row.get("hire_date") or ""),
                    "licenseNo": row.get("license_number") or "",
                    "triageCount": int(row.get("triage_count") or 0),
                    "records": []
                })

            return {"success": True, "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取護理師資料失敗: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.get("/{nurse_id}/records")
async def get_nurse_records(nurse_id: str, limit: int = 30):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    tr.triage_id,
                    COALESCE(p.name, '未知病患') AS patient_name,
                    lv.triage_level AS triage_level,
                    COALESCE(e.visit_time, tr.created_at) AS arrival_at,
                    CASE
                        WHEN lv.triage_id IS NULL THEN '未完成'
                        ELSE '已完成'
                    END AS status
                FROM triage_record tr
                LEFT JOIN patients p ON p.patient_id = tr.patient_id
                LEFT JOIN encounter_extra e ON e.triage_id = tr.triage_id
                LEFT JOIN (
                    SELECT r.triage_id, MIN(h.ttas_degree) AS triage_level
                    FROM triage_result r
                    LEFT JOIN triage_hierarchy h ON h.rule_code = r.rule_code
                    GROUP BY r.triage_id
                ) lv ON lv.triage_id = tr.triage_id
                WHERE tr.nurse_id = %s
                ORDER BY COALESCE(e.visit_time, tr.created_at) DESC
                LIMIT %s
                """,
                (nurse_id, limit)
            )
            rows = cur.fetchall() or []

            records = []
            for r in rows:
                row = r if isinstance(r, dict) else {}
                triage_level = row.get("triage_level")
                records.append({
                    "triageId": row.get("triage_id") or "",
                    "patientName": row.get("patient_name") or "",
                    "triageLevel": "none" if triage_level is None else normalize_triage_level(triage_level),
                    "arrivalAt": str(row.get("arrival_at") or ""),
                    "status": row.get("status") or "未完成",
                })

            return {"success": True, "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"讀取護理紀錄失敗: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.post("")
async def create_nurse(payload: NurseCreateRequest):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            username = (payload.username or "").strip()
            if not username:
                username = f"staff{payload.nurseId}" if payload.nurseId else "staff"

            password = (payload.password or "").strip() or "0000"

            has_custom_id = bool((payload.nurseId or "").strip())

            if has_custom_id:
                cur.execute(
                    """
                    INSERT INTO staff (
                        nurse_id, name, role, department, shift_type, phone,
                        hire_date, email, license_number, status, username, password
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.nurseId.strip(),
                        payload.name.strip(),
                        payload.role.strip() or "護理師",
                        payload.department.strip() or "急診",
                        payload.shift.strip() or "白班",
                        (payload.phone or "").strip() or None,
                        (payload.hireDate or "").strip() or None,
                        (payload.email or "").strip() or None,
                        (payload.licenseNo or "").strip() or None,
                        payload.status.strip() or "在職",
                        username,
                        password
                    )
                )
                nurse_id = payload.nurseId.strip()
            else:
                cur.execute(
                    """
                    INSERT INTO staff (
                        name, role, department, shift_type, phone,
                        hire_date, email, license_number, status, username, password
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        payload.name.strip(),
                        payload.role.strip() or "護理師",
                        payload.department.strip() or "急診",
                        payload.shift.strip() or "白班",
                        (payload.phone or "").strip() or None,
                        (payload.hireDate or "").strip() or None,
                        (payload.email or "").strip() or None,
                        (payload.licenseNo or "").strip() or None,
                        payload.status.strip() or "在職",
                        username,
                        password
                    )
                )
                nurse_id = str(cur.lastrowid)

            cur.execute(
                """
                SELECT
                    nurse_id, name, role, department, shift_type, status,
                    phone, email, hire_date, license_number
                FROM staff
                WHERE nurse_id = %s
                """,
                (nurse_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="新增後讀取資料失敗")

            d = row if isinstance(row, dict) else {}
            return {
                "success": True,
                "data": {
                    "isActive": ((d.get("status") or "").strip() != "停用"),
                    "nurseId": str(d.get("nurse_id") or ""),
                    "name": d.get("name") or "",
                    "role": d.get("role") or "",
                    "department": d.get("department") or "",
                    "shift": d.get("shift_type") or "",
                    "status": d.get("status") or "",
                    "phone": d.get("phone") or "",
                    "email": d.get("email") or "",
                    "hireDate": str(d.get("hire_date") or ""),
                    "licenseNo": d.get("license_number") or "",
                    "triageCount": 0,
                    "records": []
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"新增護理師失敗: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.delete("/{nurse_id}")
async def delete_nurse(nurse_id: str):
    raise HTTPException(status_code=405, detail="刪除帳號已停用，請改用停用/啟用功能")


@router.put("/{nurse_id}/active")
async def set_nurse_active(nurse_id: str, payload: NurseActivationRequest):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            next_status = "在職" if payload.active else "停用"
            cur.execute(
                "UPDATE staff SET status = %s WHERE nurse_id = %s",
                (next_status, nurse_id)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到護理師帳號")

            cur.execute(
                "SELECT nurse_id, name, role, department, shift_type, status, phone, email, hire_date, license_number FROM staff WHERE nurse_id = %s",
                (nurse_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="更新後讀取資料失敗")

            d = row if isinstance(row, dict) else {}
            status = (d.get("status") or "").strip()
            return {
                "success": True,
                "data": {
                    "nurseId": str(d.get("nurse_id") or ""),
                    "name": d.get("name") or "",
                    "role": d.get("role") or "",
                    "department": d.get("department") or "",
                    "shift": d.get("shift_type") or "",
                    "status": status,
                    "isActive": status != "停用",
                    "phone": d.get("phone") or "",
                    "email": d.get("email") or "",
                    "hireDate": str(d.get("hire_date") or ""),
                    "licenseNo": d.get("license_number") or "",
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新護理師狀態失敗: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/{nurse_id}")
async def update_nurse(nurse_id: str, payload: dict):
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            # 允許修改的欄位
            updates = []
            values = []
            
            if "name" in payload and payload["name"]:
                updates.append("name = %s")
                values.append(payload["name"].strip())
            if "role" in payload:
                updates.append("role = %s")
                values.append(payload["role"].strip() or "護理師")
            if "department" in payload:
                updates.append("department = %s")
                values.append(payload["department"].strip() or "急診")
            if "shift" in payload:
                updates.append("shift_type = %s")
                values.append(payload["shift"].strip() or "白班")
            if "status" in payload:
                updates.append("status = %s")
                values.append(payload["status"].strip() or "在職")
            if "phone" in payload:
                updates.append("phone = %s")
                values.append((payload["phone"] or "").strip() or None)
            if "email" in payload:
                updates.append("email = %s")
                values.append((payload["email"] or "").strip() or None)
            if "hireDate" in payload:
                updates.append("hire_date = %s")
                values.append((payload["hireDate"] or "").strip() or None)
            if "licenseNo" in payload:
                updates.append("license_number = %s")
                values.append((payload["licenseNo"] or "").strip() or None)
            
            if not updates:
                raise HTTPException(status_code=400, detail="無更新內容")
            
            values.append(nurse_id)
            sql = f"UPDATE staff SET {', '.join(updates)} WHERE nurse_id = %s"
            
            cur.execute(sql, values)
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到護理師帳號")
            
            # 讀取更新後的資料
            cur.execute(
                "SELECT nurse_id, name, role, department, shift_type, status, phone, email, hire_date, license_number FROM staff WHERE nurse_id = %s",
                (nurse_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="更新後讀取資料失敗")
            
            d = row if isinstance(row, dict) else {}
            status = (d.get("status") or "").strip()
            return {
                "success": True,
                "data": {
                    "nurseId": str(d.get("nurse_id") or ""),
                    "name": d.get("name") or "",
                    "role": d.get("role") or "",
                    "department": d.get("department") or "",
                    "shift": d.get("shift_type") or "",
                    "status": status,
                    "isActive": status != "停用",
                    "phone": d.get("phone") or "",
                    "email": d.get("email") or "",
                    "hireDate": str(d.get("hire_date") or ""),
                    "licenseNo": d.get("license_number") or "",
                }
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新護理師資料失敗: {str(e)}")
    finally:
        if conn:
            conn.close()


@router.put("/{nurse_id}/password")
async def update_password(nurse_id: str, payload: dict):
    conn = None
    try:
        if not payload.get("currentPassword"):
            raise HTTPException(status_code=400, detail="原密碼不可為空")
        if not payload.get("newPassword"):
            raise HTTPException(status_code=400, detail="新密碼不可為空")
        
        conn = get_conn()
        with conn.cursor() as cur:
            # 查詢現有密碼
            cur.execute(
                "SELECT password FROM staff WHERE nurse_id = %s",
                (nurse_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="找不到護理師帳號")
            
            current_password_in_db = row.get("password") if isinstance(row, dict) else row[0]
            
            # 驗證原密碼是否正確
            if payload.get("currentPassword").strip() != current_password_in_db:
                raise HTTPException(status_code=403, detail="原密碼錯誤")
            
            # 更新新密碼
            new_password = payload["newPassword"].strip()
            cur.execute(
                "UPDATE staff SET password = %s WHERE nurse_id = %s",
                (new_password, nurse_id)
            )
            
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="找不到護理師帳號")
            
            return {"success": True, "message": "密碼已更新"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"更新密碼失敗: {str(e)}")
    finally:
        if conn:
            conn.close()