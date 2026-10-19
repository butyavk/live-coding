from datetime import timedelta

DAYS_WITH_SALES = """
    SELECT DISTINCT CAST(t.start_time AS DATE) AS day
    FROM transactions t
    JOIN products p ON p.id = t.product_id
    WHERE p.merchant_id = ?
      AND NOT t.is_test
      AND t.revenue_usd > 0
      AND t.start_time >= ?
      AND t.start_time <  ?
    ORDER BY day
"""


def longest_streak(con, merchant_id, first_day, last_day):
    rows = con.execute(DAYS_WITH_SALES, [merchant_id, first_day, last_day + timedelta(days=1)]).fetchall()
    days = [r[0] for r in rows]                       # sorted, unique: the heavy work stays in SQL
    best_len, best_start = 0, None
    run_len, run_start = 0, None
    previous = None
    for day in days:
        if previous is not None and day == previous + timedelta(days=1):
            run_len += 1
        else:
            run_len, run_start = 1, day
        if run_len > best_len:                        # strictly greater: the earliest run wins ties
            best_len, best_start = run_len, run_start
        previous = day
    return best_len, best_start
