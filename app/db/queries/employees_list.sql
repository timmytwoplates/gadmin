SELECT
    id, first_name, last_name, email, direction, job_title,
    org_unit, email_group, manager_email, processed_by, processed_at, notes
FROM employees
WHERE deleted_at IS NULL
ORDER BY processed_at DESC
LIMIT :limit OFFSET :offset
