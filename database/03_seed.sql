-- Optional demo data (`npm run db:seed`). Uses INSERT IGNORE, so existing rows with the
-- same IDs are never overwritten. Includes employees 657, 50403 and 50404, which the
-- `users` insert in zam_hrms.sql refers to.
use zam_hrms;

insert ignore into employees
  (employee_id, employee_name, email, phone, cnic, joining_date, confirmation_date, gross_salary, department_id, designation_id, status, manager_id, gender, address)
values
  (657,   'Ayesha Khan',  'ayesha.khan@zam.com',  '0300-1234567', '35202-1111111-1', '2019-02-01', '2019-08-01', 350000, 3, 1, 'Permanent', null, 'Female', 'DHA Phase 5, Karachi'),
  (50401, 'Bilal Ahmed',  'bilal.ahmed@zam.com',  '0301-2345678', '35202-2222222-2', '2020-06-15', '2020-12-15', 280000, 2, 2, 'Permanent', 657,  'Male',   'Gulshan-e-Iqbal, Karachi'),
  (50403, 'Usman Ali',    'usman.ali@zam.com',    '0302-3456789', '35202-3333333-3', '2022-03-01', '2022-09-01', 120000, 2, 3, 'Permanent', 50401, 'Male',  'North Nazimabad, Karachi'),
  (50404, 'Sana Tariq',   'sana.tariq@zam.com',   '0303-4567890', '35202-4444444-4', '2026-07-01', null,         95000, 1, 4, 'Probation', 657,  'Female', 'Clifton, Karachi'),
  (50405, 'Kamran Shah',  'kamran.shah@zam.com',  '0304-5678901', '35202-5555555-5', '2018-01-10', '2018-07-10',  45000, 1, 6, 'Permanent', 657,  'Male',   'Malir, Karachi');

insert ignore into users (user_id, employee_id, username, hash_password, role_id, is_active) values
  (1, 657,   '657',   '657',   1, 1),
  (2, 50403, '50403', '50403', 3, 1),
  (3, 50404, '50404', '50404', 3, 1),
  (4, 50401, '50401', '50401', 2, 1),
  (5, 50405, '50405', '50405', 3, 1);

insert ignore into leave_type (leave_type_id, leave_type, grant_method, max_limit, approval_required, applicable_after_probation) values
  (1, 'Annual Leave', 'Yearly', 14, 1, 1),
  (2, 'Casual Leave', 'Yearly', 10, 1, 0),
  (3, 'Sick Leave',   'Yearly', 8,  1, 0),
  (4, 'Unpaid Leave', 'Ad_hoc', 30, 1, 0);
