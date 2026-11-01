// leave_request + leave_transactions.
//
// HR has the final say: the request's status is hr_status. A department head's decision
// (manager_status) is the first level and is required only when the employee reports to one.
export const MANAGER_ROLE_NAMES = ['Department_Head', 'Manager'];

export const loadLeaves = async (conn, { employeeId = null, approvedOnly = false, teamOfEmployeeId = null } = {}) => {
  const where = [];
  const params = [];
  if (employeeId) { where.push('lr.employee_id = ?'); params.push(employeeId); }
  if (teamOfEmployeeId) { where.push('e.manager_id = ?'); params.push(teamOfEmployeeId); }
  if (approvedOnly) where.push("lr.hr_status = 'Approved'");
  const [rows] = await conn.query(
    `select lr.*, lt.leave_type, e.manager_id as reports_to_id,
            eh.employee_name as hr_name, emgr.employee_name as manager_action_name,
            rm.role_name as reports_to_role
     from leave_request lr
     join leave_type lt on lt.leave_type_id = lr.leave_type_id
     join employees e on e.employee_id = lr.employee_id
     left join users uh on uh.user_id = lr.hr_id
     left join employees eh on eh.employee_id = uh.employee_id
     left join users um on um.user_id = lr.manager_id
     left join employees emgr on emgr.employee_id = um.employee_id
     left join users ur on ur.employee_id = e.manager_id and ur.is_active = 1
     left join roles rm on rm.role_id = ur.role_id
     ${where.length ? `where ${where.join(' and ')}` : ''}
     order by lr.from_date desc`,
    params
  );
  return rows.map((r) => {
    const managerRequired = MANAGER_ROLE_NAMES.includes(r.reports_to_role);
    return {
      id: r.leave_request_id,
      reqCode: `LR-${r.leave_request_id}`,
      empId: String(r.employee_id),
      leaveTypeId: r.leave_type_id,
      leaveType: r.leave_type,
      fromDate: r.from_date,
      toDate: r.to_date,
      days: r.total_days,
      reason: r.reason || '',
      status: r.hr_status,
      managerRequired,
      managerEmpId: r.reports_to_id ? String(r.reports_to_id) : null,
      managerStatus: managerRequired || r.manager_status !== 'Pending' ? r.manager_status : 'Not required',
      managerBy: r.manager_action_name || null,
      submittedAt: String(r.request_date || '').slice(0, 10),
      decidedBy: r.hr_name || null,
    };
  });
};

export const insertLeaveRequest = async (conn, { employeeId, leaveTypeId, fromDate, toDate, days, reason }) => {
  const [res] = await conn.query(
    'insert into leave_request (employee_id, leave_type_id, from_date, to_date, total_days, reason, manager_action_date) values (?,?,?,?,?,?,null)',
    [employeeId, leaveTypeId, fromDate, toDate, days, reason]
  );
  return res.insertId;
};

export const findLeaveRequest = async (conn, id, { forUpdate = false, withReportsTo = false } = {}) => {
  const sql = withReportsTo
    ? 'select lr.*, e.manager_id as reports_to_id from leave_request lr join employees e on e.employee_id = lr.employee_id where lr.leave_request_id = ?'
    : 'select * from leave_request lr where lr.leave_request_id = ?';
  const [[req]] = await conn.query(`${sql}${forUpdate ? ' for update' : ''}`, [id]);
  return req || null;
};

export const setHrDecision = (conn, id, { status, hrId, approvedDays }) =>
  conn.query('update leave_request set hr_status = ?, hr_id = ?, approved_days = ? where leave_request_id = ?', [status, hrId, approvedDays, id]);

export const setManagerDecision = (conn, id, { status, managerId }) =>
  conn.query('update leave_request set manager_status = ?, manager_id = ?, manager_action_date = curdate() where leave_request_id = ?', [status, managerId, id]);

export const deleteLeaveRequest = (conn, id) => conn.query('delete from leave_request where leave_request_id = ?', [id]);

export const insertLeaveTransaction = (conn, { employeeId, leaveTypeId, leaveRequestId, days, remarks }) =>
  conn.query(
    'insert into leave_transactions (employee_id, leave_type_id, leave_request_id, days, remarks) values (?,?,?,?,?)',
    [employeeId, leaveTypeId, leaveRequestId, days, remarks]
  );

export const leaveTypeName = async (conn, leaveTypeId) => {
  const [[lt]] = await conn.query('select leave_type from leave_type where leave_type_id = ?', [leaveTypeId]);
  return lt?.leave_type || null;
};
