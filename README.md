# Zam HRMS — Human Resource Management System

```
zam-shipping---fleet-hrms/
├── frontend/   React + Vite web app (port 3000)
├── backend/    Express API on MySQL (port 4000) + database scripts, .env
├── database/   SQL files: your schema, extensions, demo seed
└── shared/     Rules used by both: attendance, leave, payroll, dates, roles & permissions
```

In development the frontend forwards every `/api` request to the backend, so you open only http://localhost:3000.

### Backend structure

```
backend/
├── scripts/                 db-setup.js, db-seed.js, sql-runner.js
└── src/
    ├── server.js            entry point: starts the HTTP server and background jobs
    ├── app.js               Express app: JSON body, /api routes, error handler, frontend/dist in production
    ├── config/              env.js (reads .env), database.js (MySQL pool, transactions)
    ├── routes/              URL → controller (+ requireAuth): health, auth, state, actions
    ├── controllers/         read the request, call a service, send the JSON response
    ├── middleware/          auth.middleware.js (Bearer token → req.user), error.middleware.js (404 + errors)
    ├── services/            business rules, one file per module: auth, state, employee, access,
    │                        attendance, regularization, leave, organization, payroll, policy;
    │                        action.service.js maps POST /api/actions/:name to these functions
    ├── repositories/        all SQL, one file per table group (employee, attendance, leave, payroll, user, audit…)
    ├── jobs/                background jobs (auto-absent every 10 minutes)
    └── utils/               errors, validators, tokens, passwords, formatting, attendance-engine glue
```

A request flows **route → middleware → controller → service → repository → MySQL**. Each action runs in one transaction, checks permissions and writes an `audit_log` row.

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Database connectivity check |
| `POST /api/auth/login` | `{ username, password }` → token + user. The role comes from the account in the database. |
| `GET /api/auth/me` | Current user |
| `GET /api/state` | Everything the user's role may see |
| `POST /api/actions/:name` | `{ args: [...] }` — every change (e.g. `markAttendance`, `decideLeave`, `finalizePayroll`) |

## First-time setup

Prerequisites: Node.js 20+ and MySQL 8 (the `MySQL80` service).

1. Open `backend/.env` and enter your MySQL password:
   ```
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   ```
2. From the **project root**, install packages and create the database. One `npm i` installs both frontend and backend:
   ```bash
   npm i
   npm run db:setup     # runs database/zam_hrms.sql, then database/02_extensions.sql
   npm run db:seed      # OPTIONAL demo data (employees 657 / 50401 / 50403 / 50404 / 50405, ~2 months of attendance)
   npm run db:setup     # run again after seeding so the users rows in zam_hrms.sql get inserted
   ```
3. Start everything:
   ```bash
   npm run dev          # backend on :4000 + frontend on :3000 → open http://localhost:3000
   ```
   To run them separately, use `npm run dev:backend` and `npm run dev:frontend` in two terminals.

`db:setup` is safe to run again; steps that were already applied are skipped. If your database already has real employees, skip `db:seed`.

## Database files

| File | Purpose |
|------|---------|
| `database/zam_hrms.sql` | Your schema, unchanged |
| `database/02_extensions.sql` | Additive columns and tables the app needs: reporting manager, personal/emergency/bank details, check-in method, GPS location, breaks, correction check-out time, job history, payroll runs, settings, policy acknowledgements |
| `database/03_seed.sql` | Optional demo rows (`INSERT IGNORE`, never overwrites) |

## Logins and roles

On the login screen you enter only `users.username` (or employee email) and password. The server checks the password and reads the account's role (HR, Department_Head or Employee) from the database, and that role decides which screens open. Plain-text passwords (such as `'657'` in zam_hrms.sql) are accepted once and then re-saved as bcrypt hashes.

| `roles.role_name` | App access |
|-------------------|------------|
| HR | **Owner**: everything |
| Department_Head | **Manager**: attendance (daily attendance, P/A/L/HD marking, timesheets, corrections) plus first-level leave approval for employees who report to them. No salaries, payroll or personnel data. |
| Employee | **Employee**: own attendance, payslips, leave, profile, policies |

The role matrix is in `shared/permissions.js`. The server applies it to every request, so a role never receives data it may not see.

Demo logins after `db:seed`: `657 / 657` (HR), `50401 / 50401` (Department Head), `50403 / 50403` (Employee).

## Attendance marking

On **Daily Attendance**, HR and Department Heads can:
- mark each person **P** (Present), **A** (Absent), **L** (Late) or **HD** (Half Day). The mark is stored in `attendance.status` with `is_manual = 1`;
- click **Mark all as Present** to mark everyone who has no attendance yet for the date. Employees on approved leave, and anyone with attendance already recorded, are left unchanged;
- use **Times** to enter an exact check-in and check-out. The status is then calculated from the employee's schedule (`late_after`, `half_day_after`).

## Attendance rules

Each employee follows the schedule of their designation. Example, Non Manager (08:45, late after 09:00, half day after 10:30, out 18:00):

| Check-in | Status |
|----------|--------|
| up to 09:00 | Present |
| 09:01 – 10:30 | Late |
| after 10:30 (any time until the end of the day) | Half Day |
| no check-in by 18:00 | **Absent** — written automatically |

The backend's auto-absent job runs at start-up and every 10 minutes. It writes `Absent` (method `Auto`) for working days with no attendance row. Off days, holidays, approved leave and days before joining are skipped. `AUTO_ABSENT_DAYS` in `backend/.env` sets how far back it looks (default 31; `0` turns it off). HR or the department head can still mark the person Present.

## Leave approval

1. The employee applies. Working days are counted automatically (off days and holidays excluded).
2. If the employee reports to a Department Head, that Department Head approves or rejects first (`manager_status`).
3. **HR gives the final decision** (`hr_status`). HR can decide even while the department head's decision is still pending.
4. On HR approval, every working day of the leave is written to `attendance` as **On Leave**, and a `leave_transactions` row is added.

## Payroll (PKR)
- **Pay period:** each month runs from the 26th to the 25th of the next month and is named after the month it ends in (November 2026 = 26 Oct – 25 Nov 2026). Payroll, timesheets, reports and the dashboard all use this period. To change the start day, edit `PAY_PERIOD_START_DAY` in `shared/dates.js`.
- `employees.gross_salary` is the **monthly** gross. It is split into Basic 60%, House Rent 30% and Utility 10%.
- Overtime is paid at 1.5x on working days and 2x on off days, with hourly rate = gross ÷ 176.
- Loss of pay applies for absences, unpaid leave, half days, every 3 late arrivals (½ day), and days before joining.
- Income tax uses the FBR salaried slabs (Finance Act 2025). EOBI is Rs 370 for the employee and Rs 1,850 for the employer.
- All rates can be edited under **Payroll → Pay rules & tax**.
- Finalizing a month stores the payslips in `payroll_run` and publishes them to employees.

## Configuration

- `frontend/src/config/offices.js` holds the office coordinates for GPS check-in. **Set your real office latitude and longitude.**
- `backend/.env` holds the database connection, `AUTH_SECRET` (signs login sessions) and the API `PORT` (4000).

## Production

```bash
npm run build        # builds frontend/dist
npm start            # backend serves the API and frontend/dist on :4000
```
#   Z a m - S h i p p i n g - L i n e - H R M S  
 