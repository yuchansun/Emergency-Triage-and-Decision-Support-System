# from fastapi import FastAPI, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# import pymysql.cursors
# import os

# app = FastAPI()

# # 允許跨域請求
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_methods=["GET", "POST", "OPTIONS"],
#     allow_headers=["*"],
# )

# # 連接資料庫的函式
# def get_conn():
#     return pymysql.connect(
#         host=os.getenv("DB_HOST", "localhost"),
#         user=os.getenv("DB_USER", "your_db_user"),
#         password=os.getenv("DB_PASS", "your_db_password"),
#         db=os.getenv("DB_NAME", "your_db_name"),
#         charset="utf8mb4",
#         cursorclass=pymysql.cursors.DictCursor,
#         autocommit=True,
#     )

# @app.get("/get_cc_with_counts")
# def get_cc_with_counts():
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             cur.execute("SELECT category, system_code, system_name, symptom_code, symptom_name, `count` FROM cc_with_counts")
#             rows = cur.fetchall()
#         return rows
#     except pymysql.MySQLError as e:
#         raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
#     finally:
#         if conn:
#             conn.close()