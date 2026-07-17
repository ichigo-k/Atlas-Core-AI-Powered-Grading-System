-- Rebuild persisted attempt totals after the old grader incorrectly treated the
-- previously persisted final score as the objective-question subtotal during a
-- re-grade. That caused subjective marks to be added more than once.
--
-- Score precedence matches the lecturer adjustment endpoint:
--   1. lecturer-adjusted per-question score
--   2. latest AI answer-feedback score
--   3. objective auto-score from selectedOption = correctOption
--
-- Prisma remains the sole migration authority for both the portal and grader
-- tables. This is a one-time, idempotent data repair.

WITH latest_feedback AS (
    SELECT DISTINCT ON (feedback."gradingResultId", feedback."questionId")
        feedback."gradingResultId",
        feedback."questionId",
        feedback."totalScore"
    FROM "grader_answerfeedback" AS feedback
    ORDER BY
        feedback."gradingResultId",
        feedback."questionId",
        feedback."id" DESC
),
question_scores AS (
    SELECT
        attempt."id" AS "attemptId",
        answer."questionId",
        CASE
            WHEN answer."lecturer_adjusted_score" IS NOT NULL THEN
                LEAST(
                    GREATEST(answer."lecturer_adjusted_score", 0),
                    question."marks"::DOUBLE PRECISION
                )
            WHEN feedback."totalScore" IS NOT NULL THEN
                LEAST(
                    GREATEST(feedback."totalScore", 0),
                    question."marks"::DOUBLE PRECISION
                )
            WHEN section."type" = 'OBJECTIVE'
                AND question."correctOption" IS NOT NULL
                AND answer."selectedOption" = question."correctOption"
                THEN question."marks"::DOUBLE PRECISION
            ELSE 0::DOUBLE PRECISION
        END AS "questionScore"
    FROM "assessment_attempts" AS attempt
    INNER JOIN "student_answers" AS answer
        ON answer."attemptId" = attempt."id"
    INNER JOIN "questions" AS question
        ON question."id" = answer."questionId"
        AND question."assessmentId" = attempt."assessmentId"
    INNER JOIN "assessment_sections" AS section
        ON section."id" = question."sectionId"
    LEFT JOIN "grader_gradingresult" AS grading_result
        ON grading_result."attemptId" = attempt."id"
    LEFT JOIN latest_feedback AS feedback
        ON feedback."gradingResultId" = grading_result."id"
        AND feedback."questionId" = question."id"
    WHERE attempt."status" IN ('SUBMITTED', 'TIMED_OUT')
      AND CASE
          WHEN attempt."activeQuestionIds" IS NULL THEN TRUE
          WHEN jsonb_typeof(attempt."activeQuestionIds") <> 'array' THEN TRUE
          ELSE jsonb_array_length(attempt."activeQuestionIds") = 0
              OR attempt."activeQuestionIds" @> jsonb_build_array(question."id")
      END
),
recalculated AS (
    SELECT
        attempt."id" AS "attemptId",
        LEAST(
            COALESCE(SUM(question_scores."questionScore"), 0),
            assessment."totalMarks"::DOUBLE PRECISION
        ) AS "score"
    FROM "assessment_attempts" AS attempt
    INNER JOIN "assessments" AS assessment
        ON assessment."id" = attempt."assessmentId"
    LEFT JOIN question_scores
        ON question_scores."attemptId" = attempt."id"
    WHERE attempt."status" IN ('SUBMITTED', 'TIMED_OUT')
    GROUP BY attempt."id", assessment."totalMarks"
)
UPDATE "assessment_attempts" AS attempt
SET "score" = recalculated."score"
FROM recalculated
WHERE attempt."id" = recalculated."attemptId";

-- Keep the grader-owned summary row consistent with the repaired portal score.
UPDATE "grader_gradingresult" AS grading_result
SET "score" = attempt."score"
FROM "assessment_attempts" AS attempt
WHERE grading_result."attemptId" = attempt."id"
  AND attempt."status" IN ('SUBMITTED', 'TIMED_OUT');
