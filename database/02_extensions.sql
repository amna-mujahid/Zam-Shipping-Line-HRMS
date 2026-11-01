-- Additive extensions used by the HRMS app. Nothing in zam_hrms.sql is changed.
-- Each change is its own statement so `npm run db:setup` can safely re-run this file
-- (statements that were already applied are skipped).
use zam_hrms;

-- Employee profile: reporting line, personal details, emergency contact, salary bank account
alter table employees add column manager_id int null;
alter table employees add constraint fk_emp_manager foreign key (manager_id) references employees(employee_id) on delete set null;
alter table employees add column dob date null;
alter table employees add column gender varchar(10) null;
alter table employees add column marital_status varchar(20) null;
alter table employees add column address varchar(255) null;
alter table employees add column personal_email varchar(100) null;
alter table employees add column emergency_name varchar(100) null;
alter table employees add column emergency_relation varchar(50) null;
alter table employees add column emergency_phone varchar(20) null;
alter table employees add column bank_name varchar(100) null;
alter table employees add column bank_account varchar(50) null;
alter table employees add column bank_branch_code varchar(20) null;
alter table employees add column office_id varchar(20) null;

-- Attendance: manual marks (P/A/L/HD), capture method, GPS location, breaks
alter table attendance add column is_manual boolean not null default false;
alter table attendance add column check_in_method varchar(20) null;
alter table attendance add column location json null;
alter table attendance add column breaks json null;

-- Attendance corrections: requested check-out and the punches as they were when requested
alter table attendance_request add column updated_out_time time null;
alter table attendance_request add column original_in_time time null;
alter table attendance_request add column original_out_time time null;

create table if not exists employee_job_history (
    job_history_id int auto_increment primary key,
    employee_id int not null,
    event_date date not null,
    event varchar(30) not null,
    title varchar(100) not null,
    department varchar(50) null,
    note varchar(255) null,
    constraint fk_jobhist_employee foreign key (employee_id) references employees(employee_id)
);

create table if not exists payroll_run (
    month_key char(7) primary key,
    status varchar(20) not null default 'FINALIZED',
    finalized_at datetime not null default current_timestamp,
    finalized_by int null,
    payslips json not null,
    constraint fk_payroll_user foreign key (finalized_by) references users(user_id) on delete set null
);

create table if not exists app_settings (
    setting_key varchar(50) primary key,
    setting_value json not null
);

create table if not exists policy_ack (
    employee_id int not null,
    policy_id varchar(50) not null,
    ack_date date not null default (current_date),
    primary key (employee_id, policy_id),
    constraint fk_policyack_employee foreign key (employee_id) references employees(employee_id)
);
