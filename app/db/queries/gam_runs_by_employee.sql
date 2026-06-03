SELECT
    id, employee_id, step_name, command_text,
    stdout, stderr, exit_code, success, ran_by, ran_at
FROM gam_runs
WHERE employee_id = :employee_id
ORDER BY ran_at ASC
