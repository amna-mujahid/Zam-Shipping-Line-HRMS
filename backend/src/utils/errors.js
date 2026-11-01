// ActionError = a rule the user broke (shown to them as-is, HTTP 200 with ok: false).
export class ActionError extends Error {}

export const fail = (msg) => {
  throw new ActionError(msg);
};

// Turns MySQL errors into messages a user can act on.
export const friendlyDbError = (err) => {
  switch (err.code) {
    case 'ER_DUP_ENTRY': {
      const m = /for key '(?:[\w]+\.)?([\w]+)'/.exec(err.sqlMessage || '');
      const key = m ? m[1] : '';
      if (/cnic/i.test(key)) return 'An employee with this CNIC already exists.';
      if (/username/i.test(key)) return 'This username is already taken.';
      if (/PRIMARY/.test(key)) return 'A record with this ID already exists.';
      return `Duplicate value (${key || 'unique field'}).`;
    }
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return `Value not allowed by database rule: ${err.sqlMessage}`;
    case 'ER_NO_REFERENCED_ROW_2':
      return 'A referenced record (department, designation, employee…) does not exist.';
    case 'ER_ROW_IS_REFERENCED_2':
      return 'This record is in use and cannot be deleted.';
    case 'ER_ACCESS_DENIED_ERROR':
      return 'MySQL rejected the login. Check DB_USER / DB_PASSWORD in .env.';
    case 'ER_BAD_DB_ERROR':
      return 'Database zam_hrms does not exist. Run: npm run db:setup';
    case 'ECONNREFUSED':
      return 'Cannot connect to MySQL. Is the MySQL80 service running? Check DB_HOST / DB_PORT in .env.';
    case 'ER_NO_SUCH_TABLE':
    case 'ER_BAD_FIELD_ERROR':
      return `Database schema is out of date (${err.sqlMessage}). Run: npm run db:setup`;
    default:
      return null;
  }
};
