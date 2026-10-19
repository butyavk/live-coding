import random, sys, time
from datetime import date, datetime, timedelta
from conftest import load
import db


def brute(subs, first, last):
    out, day = {}, first
    while day <= last:
        m = datetime.combine(day, datetime.min.time())
        out[day] = sum(1 for s, e in subs if s <= m < e)
        day += timedelta(days=1)
    return out


def test_edges():
    f = load("p05_daily_actives").daily_active_counts
    subs = [(datetime(2026, 9, 1), datetime(2026, 9, 3)),          # active on 1st and 2nd
            (datetime(2026, 9, 1, 0, 0, 1), datetime(2026, 9, 2, 12)),  # starts after midnight: 2nd only
            (datetime(2026, 8, 1), datetime(2026, 10, 1)),          # covers the whole window
            (datetime(2026, 9, 5, 10), datetime(2026, 9, 5, 11))]   # never active at a midnight
    first, last = date(2026, 9, 1), date(2026, 9, 6)
    assert f(subs, first, last) == brute(subs, first, last)
    assert f([], first, last) == {first + timedelta(days=i): 0 for i in range(6)}


def test_matches_sql_q04_on_the_dataset():
    con = db.connect()
    subs = con.execute("""SELECT start_time, LEAST(end_time, COALESCE(refunded_at, end_time)) FROM transactions
                          WHERE NOT is_trial AND NOT is_test AND channel <> 'promo'
                            AND LEAST(end_time, COALESCE(refunded_at, end_time)) > start_time""").fetchall()
    expected = dict(con.execute(open(db.ROOT / "solutions" / "sql" / "q04.sql").read()).fetchall())
    got = load("p05_daily_actives").daily_active_counts(subs, date(2026, 9, 1), date(2026, 9, 30))
    assert got == expected


def test_random_against_brute_force():
    f = load("p05_daily_actives").daily_active_counts
    rnd = random.Random(1)
    base = datetime(2026, 9, 1)
    subs = []
    for _ in range(300):
        s = base + timedelta(hours=rnd.randint(-100, 500))
        subs.append((s, s + timedelta(hours=rnd.randint(1, 300))))
    assert f(subs, date(2026, 9, 1), date(2026, 9, 20)) == brute(subs, date(2026, 9, 1), date(2026, 9, 20))


def test_fast_enough():
    f = load("p05_daily_actives").daily_active_counts
    rnd = random.Random(2)
    base = datetime(2025, 1, 1)
    subs = []
    for _ in range(200_000):
        s = base + timedelta(minutes=rnd.randint(0, 600 * 1440))
        subs.append((s, s + timedelta(days=rnd.choice([7, 30, 365]))))
    limit = 4.0 if sys.platform == "emscripten" else 2.0      # Python in the browser is 2-3 times slower
    t = time.perf_counter()
    f(subs, date(2025, 6, 1), date(2026, 5, 31))
    seconds = time.perf_counter() - t
    assert seconds < limit, f"{seconds:.1f} s, the limit here is {limit:.0f} s"
