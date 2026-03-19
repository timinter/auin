-- Remove duplicate projects, keeping the oldest one
DELETE FROM projects
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM projects
  ORDER BY name, created_at ASC
);

-- Add unique constraint so upsert works correctly
ALTER TABLE projects ADD CONSTRAINT projects_name_unique UNIQUE (name);
