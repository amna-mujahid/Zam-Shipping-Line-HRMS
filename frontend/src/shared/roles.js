export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
};

// Maps rows of the `roles` table to app access levels.
// HR = full access (owner), Department_Head = attendance only (manager).
export const DB_ROLE_TO_APP = {
  HR: ROLES.OWNER,
  Owner: ROLES.OWNER,
  Department_Head: ROLES.MANAGER,
  Manager: ROLES.MANAGER,
  Employee: ROLES.EMPLOYEE,
};

export const roleFromDb = (roleName) => DB_ROLE_TO_APP[roleName] || ROLES.EMPLOYEE;
