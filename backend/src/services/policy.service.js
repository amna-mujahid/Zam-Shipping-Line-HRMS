// Company policies: employees acknowledge they have read a policy.
import { insertPolicyAck } from '../repositories/policy.repository.js';

export async function acknowledgePolicy(conn, user, policyId) {
  await insertPolicyAck(conn, user.employeeId, String(policyId).slice(0, 50));
  return {};
}
