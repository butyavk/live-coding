WITH ranked AS (
    SELECT *,
           ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY received_at) AS rn
    FROM webhook_events
)
SELECT CAST(occurred_at AS DATE)   AS day,
       type,
       COUNT(*) FILTER (WHERE rn = 1)  AS events,
       COUNT(*) FILTER (WHERE rn > 1)  AS duplicates
FROM ranked
WHERE occurred_at >= TIMESTAMP '2026-09-01'
  AND occurred_at <  TIMESTAMP '2026-09-30'
GROUP BY 1, 2
ORDER BY day, type;
