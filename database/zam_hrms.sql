create database zam_hrms;
use zam_hrms;

create table departments (
	department_id int auto_increment primary key ,
	department_name varchar(50) not null unique
);

create table designations (
	designation_id int auto_increment primary key ,
    designation_name varchar(50) not null unique
);

create table roles (
	role_id int auto_increment primary key ,
    role_name varchar(30) not null unique
);

create table employees (
	employee_id int auto_increment primary key ,
    employee_name varchar(100) not null ,
    email varchar(100) ,
    phone varchar(20) not null ,
    cnic varchar(15) not null unique ,
    joining_date date not null ,
    confirmation_date date ,
    gross_salary decimal(10,2) not null ,
    department_id int not null ,
    designation_id int not null ,
    status varchar(20) not null default 'Probation',
    constraint fk_department_id
		foreign key (department_id)
        references departments(department_id) ,
	constraint fk_designation_id
		foreign key (designation_id)
        references designations(designation_id) ,
	constraint chk_emp_status
		check (status in ('Probation' , 'Permanent' , 'Inactive' , 'Terminated'))
);

create table users (
	user_id int auto_increment primary key ,
    employee_id int not null unique ,
    username varchar(50) not null unique ,
    hash_password varchar(255) not null ,
    role_id int not null ,
    is_active boolean default TRUE ,
    created_at timestamp default current_timestamp ,
    constraint fk_users_employee
		foreign key (employee_id)
        references employees(employee_id) ,
	constraint fk_users_role
		foreign key (role_id)
        references roles(role_id)
);

create table attendance (
	attendance_id int auto_increment primary key ,
    employee_id int not null ,
    attendance_date date not null ,
    in_time time not null ,
    out_time time not null ,
    status varchar(30) default 'Absent' ,
    remarks varchar(255) ,
    constraint fk_att_employee
		foreign key (employee_id)
        references employees(employee_id) ,
	constraint att_status
		check (status in ('Absent' , 'Present' , 'Late' , 'Half Day' , 'On Leave'))
	);

create table leave_type (
	leave_type_id int auto_increment primary key ,
    leave_type varchar(50) not null unique ,
    grant_method varchar(30) not null,
    max_limit int not null  ,
    approval_required boolean  not null default TRUE,
    applicable_after_probation boolean not null default TRUE ,
    constraint chk_grant_method
		check (grant_method in ('Yearly' , 'Monthly' , 'Ad_hoc'))
    );

create table schedule (
	schedule_id int auto_increment primary key ,
    schedule_name varchar(50) not null unique ,
    reporting_time time not null ,
    late_after time not null ,
    half_day_after time not null ,
    normal_out_time time not null ,
    remarks varchar(255)
);

create table holiday (
	holiday_id int auto_increment primary key ,
    holiday_name varchar(100) not null ,
    holiday_from_date date not null ,
    holiday_to_date date not null
    );

create table calendar (
	calendar_id int auto_increment primary key ,
    calendar_date date not null unique ,
    day_name varchar(10) generated always as (dayname(calendar_date)) stored,
    day_status varchar(20) not null default 'Working' ,
    holiday_id int ,
    remarks varchar(255) ,
    constraint fk_cal_holiday
		foreign key (holiday_id)
        references holiday(holiday_id) ,
	constraint chk_cal_day_status
		check (day_status in ('Working' , 'Off Day' , 'Holiday'))
);

alter table designations
add column schedule_id INT NULL,
add constraint fk_desig_schedule
    foreign key (schedule_id)
    references schedule(schedule_id)
    on delete set null;

alter table attendance
add column calendar_id int not null after employee_id,
add constraint fk_att_calendar
    foreign key (calendar_id)
    references calendar(calendar_id);

alter table attendance
drop column attendance_date;

alter table attendance
modify column in_time time null,
modify column out_time time null;

alter table attendance
add constraint uq_emp_calendar
    unique (employee_id, calendar_id);

create table leave_request (
	leave_request_id int auto_increment primary key ,
    employee_id int not null ,
    leave_type_id int not null ,
    from_date date not null ,
    to_date date not null ,
    total_days int not null ,
    reason varchar(255) ,

    manager_status varchar(20) not null default 'Pending',
    approved_days int null ,
    manager_id int null ,
    manager_action_date date default (current_date) ,

    hr_status varchar(20) not null default 'Pending',
    hr_id int null ,

    request_date datetime default current_timestamp ,

    constraint fk_lreq_employee_id
		foreign key (employee_id)
        references employees(employee_id) ,
	constraint fk_lreq_leave_type
		foreign key (leave_type_id)
        references leave_type(leave_type_id) ,
	constraint fk_lreq_manager_id
		foreign key (manager_id)
        references users(user_id) ,
	constraint fk_lreq_hr_id
		foreign key (hr_id)
        references users(user_id) ,
	constraint chk_lreq_dates
		check(to_date >= from_date) ,
	constraint chk_lreq_manager_status
		check (manager_status in ('Pending' , 'Approved' , 'Rejected')) ,
	constraint chk_lreq_hr_status
		check (hr_status in ('Pending' , 'Approved' , 'Rejected'))
);

create table leave_transactions (
	leave_transaction_id int auto_increment primary key ,
    employee_id int not null ,
    leave_type_id int not null ,
    leave_request_id int not null ,
    transaction_date date not null default(current_date) ,
    days int not null ,
    remarks varchar(255) ,
    constraint fk_ltran_employee_id
		foreign key (employee_id)
        references employees(employee_id) ,
	constraint fk_ltran_ltype_id
		foreign key (leave_type_id)
        references leave_type(leave_type_id) ,
	constraint fk_ltran_lreq_id
		foreign key (leave_request_id)
        references leave_request(leave_request_id)
	);

create table attendance_request (
	attendance_request_id int auto_increment primary key ,
    employee_id int not null ,
    calendar_id int not null ,

    updated_in_time time not null ,
    reason varchar(255) not null ,

    hr_status varchar(20) not null default 'Pending' ,
    hr_id int null ,
    hr_remarks varchar(255) ,
	request_date date default (current_date) ,

    constraint fk_att_req_employee
		foreign key (employee_id)
        references employees(employee_id) ,
	constraint fk_att_req_calendar
		foreign key (calendar_id)
        references calendar(calendar_id) ,
	constraint fk_att_req_hr
		foreign key (hr_id)
        references users(user_id)
);

insert into departments (department_id , department_name) values
(1 , 'Administration') ,
(2 , 'Accounts') ,
(3 , 'HR')
;

select * from departments order by department_id;

alter table employees
add column employee_type varchar(20) not null default 'Internal' ,
add constraint chk_emp_type
	check (employee_type in ('Internal' , 'External_Parent'));

select * from departments;

insert into schedule (schedule_id , schedule_name , reporting_time , late_after , half_day_after , normal_out_time) values
(1 , 'Non Manager' , '08:45:00' , '09:00:00' , '10:30:00' , '18:00:00') ,
(2 , 'Manager' , '09:15:00' , '09:30:00' , '11:00:00' , '18:00:00') ,
(3 , 'Special Manager' , '09:45:00' , '10:00:00' , '10:30:00' , '18:00:00') ,
(4 , 'Admin' , '08:15:00' , '08:30:00' , '10:00:00' , '17:30:00')
;
select * from schedule;

insert into designations (designation_id , designation_name , schedule_id) values
(1 , 'HR Executive' , 1) ,
(2 , 'Accounts Manager' , 2) ,
(3 , 'Accounts Executive' , 1) ,
(4 , 'Assistant Trade Manager' , 1) ,
(5 , 'Commercial Manager' , 3 ) ,
(6 , 'Office Boy' , 4)
;

set session cte_max_recursion_depth = 10000;
insert into calendar (calendar_date , day_status)
with recursive date_range as (
    select cast('2025-01-01' as date) as cal_date
    union all
    select date_add(cal_date, interval 1 day)
    from date_range
    where cal_date < '2027-12-31'
)
select
    cal_date,
    if(dayofweek(cal_date) in (1 , 7) , 'Off Day', 'Working') as day_status
from date_range;

select * from calendar;

insert roles (role_name) values
('HR'),
('Department_Head'),
('Employee');

insert into users (user_id , employee_id , username , hash_password , role_id , is_active) values
(1 , 657 , '657' , '657' , 1 , 1) ,
(2 , 50403 , '50403' , '50403' , 3 , 1) ,
(3 , 50404 , '50404' , '50404' , 3 , 1);

SHOW CREATE TABLE attendance_request;

alter table attendance
add column created_at timestamp not null default current_timestamp ,
add column updated_at timestamp not null default current_timestamp
on update current_timestamp ,
add column created_by int null,
add column updated_by int null,
add constraint fk_att_created_by
foreign key (created_by) references users(user_id),
add constraint fk_att_updated_by
foreign key (updated_by) references users(user_id);

alter table attendance_request
add column verified_in_time time null;
alter table attendance_request
add column hr_action_at datetime null;
alter table attendance_request
add constraint chk_att_req_hr_status
check (hr_status in ('Pending', 'Approved', 'Rejected'));



create table audit_log (
    audit_id int auto_increment primary key,

    user_id int null,

    action_type varchar(30) not null,
    table_name varchar(100) not null,
    record_id int null,

    old_values json null,
    new_values json null,

    action_reason varchar(255) null,

    action_at timestamp not null default current_timestamp,

    constraint fk_audit_log_user
        foreign key (user_id)
        references users(user_id)
        on delete set null
);

describe audit_log;
