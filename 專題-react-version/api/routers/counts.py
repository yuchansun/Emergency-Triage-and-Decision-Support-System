from fastapi import APIRouter, HTTPException
import pymysql
import logging
from db import get_conn

router = APIRouter()

@router.get("/cc_with_counts")
def get_cc_with_counts():
    conn = None
    try:
        conn = get_conn()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT category, system_code, system_name,
                       symptom_code, symptom_name, `count`
                FROM cc_with_counts
            """)
            rows = cur.fetchall()
        return rows
    except pymysql.MySQLError as e:
        logging.error(str(e))
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()