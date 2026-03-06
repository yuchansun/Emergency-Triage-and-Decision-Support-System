# @app.get("/get_triage_hierarchy")
# def get_triage_hierarchy():
#     try:
#         conn = get_conn()
#         with conn.cursor() as cur:
#             cur.execute("SELECT category, system_code, system_name, symptom_code, symptom_name, rule_code, judge_name, ttas_degree, nhi_degree FROM triage_hierarchy")
#             rows = cur.fetchall()
#         return rows
#     except pymysql.MySQLError as e:
#         raise HTTPException(status_code=500, detail=f"Database query failed: {str(e)}")
#     finally:
#         if conn:
#             conn.close()