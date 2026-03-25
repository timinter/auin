-- Expand department constraint to include all PeopleForce departments
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_department_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_department_check
  CHECK (department IN (
    'Development', 'Delivery', 'HR', 'Marketing', 'Sales', 'Leadgen', 'Administrative',
    'Developers', 'BA', 'Design', 'Finance', 'PM', 'QA', 'Recruitment', 'Sales&Marketing', 'Top Management'
  ));
