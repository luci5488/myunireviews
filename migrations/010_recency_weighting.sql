-- Replace the professor_summary view to add a recency-weighted average rating.
-- Reviews from the last 12 months count 2x, 12-24 months 1.5x, older 1x.

CREATE OR REPLACE VIEW professor_summary AS
SELECT
    p.id                                                    AS professor_id,
    p.first_name,
    p.last_name,
    p.title,
    p.institution_id,
    p.department_id,
    p.is_verified,

    COUNT(r.id)                                             AS total_reviews,
    ROUND(AVG(r.overall_rating)::NUMERIC, 2)                AS avg_overall_rating,
    ROUND(AVG(r.difficulty_rating)::NUMERIC, 2)             AS avg_difficulty,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE r.would_take_again = TRUE)
        / NULLIF(COUNT(*) FILTER (WHERE r.would_take_again IS NOT NULL), 0),
        1
    )                                                       AS pct_would_take_again,

    COUNT(r.id) FILTER (WHERE r.overall_rating = 5)        AS five_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 4)        AS four_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 3)        AS three_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 2)        AS two_star,
    COUNT(r.id) FILTER (WHERE r.overall_rating = 1)        AS one_star,

    -- Recency-weighted average: recent reviews count more
    ROUND(
        CASE WHEN SUM(
            CASE
                WHEN r.created_at >= NOW() - INTERVAL '12 months' THEN 2.0
                WHEN r.created_at >= NOW() - INTERVAL '24 months' THEN 1.5
                ELSE 1.0
            END
        ) = 0 THEN NULL
        ELSE
            SUM(
                r.overall_rating *
                CASE
                    WHEN r.created_at >= NOW() - INTERVAL '12 months' THEN 2.0
                    WHEN r.created_at >= NOW() - INTERVAL '24 months' THEN 1.5
                    ELSE 1.0
                END
            ) / SUM(
                CASE
                    WHEN r.created_at >= NOW() - INTERVAL '12 months' THEN 2.0
                    WHEN r.created_at >= NOW() - INTERVAL '24 months' THEN 1.5
                    ELSE 1.0
                END
            )
        END::NUMERIC,
        2
    )                                                       AS weighted_avg_rating

FROM professors p
LEFT JOIN reviews r
    ON r.professor_id = p.id
   AND r.status = 'approved'
GROUP BY p.id;
