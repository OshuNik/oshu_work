-- Add RLS policy for UPDATE operations on vacancies table
-- Allows users to update vacancy status (add to favorites, delete, etc.)
-- Migration date: 2024-11-10

CREATE POLICY "vacancies_update_public" ON vacancies
FOR UPDATE
USING (true)  -- Users can see any vacancy
WITH CHECK (true)  -- Users can update any vacancy
