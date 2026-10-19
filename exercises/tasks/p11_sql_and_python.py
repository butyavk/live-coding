"""P11. SQL + Python together: longest sales streak   Level: medium.    Target time: 20 min.

In many interview editors the Python code can query the same database as the SQL part. Practise that here.

    longest_streak(con, merchant_id="mer_01", first_day=date(2026, 9, 1), last_day=date(2026, 9, 29))
    -> (3, date(2026, 9, 21))     # 3 days in a row with at least one paid sale, starting on Sep 21

- Use SQL to get the DAYS on which the merchant had at least one paid transaction
  (revenue_usd > 0, test purchases excluded) between first_day and last_day inclusive (day of start_time, UTC).
  Pass the parameters to the query safely: `con.execute(sql, [param1, param2, ...])` with `?` placeholders.
  Never build the SQL string with f-strings or +.
- Then, in Python, find the longest run of consecutive days. Return (length, first_day_of_that_run).
- Several runs of the same length -> the earliest one. No sales at all -> (0, None).

ASK FIRST: Why not do it all in SQL?  A: You can (gaps and islands), but here we practise SQL + Python.
           Say which part you would keep in SQL on a big table, and why.
           Which days count?  A: Days (UTC, by start_time) with at least one paid sale: revenue_usd > 0, test purchases excluded. last_day is included.
           Two runs of the same length?  A: Return the earliest one.
           No sales at all?  A: Return (0, None).
The same call with SQLAlchemy: conn.execute(sa.text("… WHERE p.merchant_id = :mer"), {"mer": merchant_id}).
"""


def longest_streak(con, merchant_id, first_day, last_day):
    raise NotImplementedError("your code")
