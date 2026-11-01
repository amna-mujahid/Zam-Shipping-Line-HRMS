// policy_ack.
export const loadPolicyAcks = async (conn, employeeId) => {
  const [rows] = await conn.query('select policy_id, ack_date from policy_ack where employee_id = ?', [employeeId]);
  return { [String(employeeId)]: rows.map((r) => ({ policyId: r.policy_id, at: r.ack_date })) };
};

export const insertPolicyAck = (conn, employeeId, policyId) =>
  conn.query('insert ignore into policy_ack (employee_id, policy_id) values (?, ?)', [employeeId, policyId]);
