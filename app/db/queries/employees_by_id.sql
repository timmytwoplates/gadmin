SELECT
    id, first_name, last_name, email, direction, job_title,
    org_unit, email_group, manager_email, processed_by, processed_at, notes
FROM employees
WHERE id = :id AND deleted_at IS NULL
