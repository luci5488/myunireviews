-- Aggregate per-criterion scores for each professor (approved reviews only).
CREATE OR REPLACE VIEW professor_criteria_averages AS
SELECT
    r.professor_id,
    rc.name                                  AS criterion,
    ROUND(AVG(rcs.score)::NUMERIC, 2)        AS avg_score,
    COUNT(rcs.score)                         AS score_count
FROM review_criterion_scores rcs
JOIN reviews r         ON r.id  = rcs.review_id   AND r.status = 'approved'
JOIN rating_criteria rc ON rc.id = rcs.criteria_id AND rc.is_active = TRUE
GROUP BY r.professor_id, rc.name;

-- Top tags per professor by count (approved reviews only).
CREATE OR REPLACE VIEW professor_top_tags AS
SELECT
    r.professor_id,
    t.name                AS tag,
    t.is_positive,
    COUNT(*)              AS tag_count
FROM review_tags rt
JOIN reviews r  ON r.id  = rt.review_id AND r.status = 'approved'
JOIN tags    t  ON t.id  = rt.tag_id    AND t.is_active = TRUE
GROUP BY r.professor_id, t.name, t.is_positive;
