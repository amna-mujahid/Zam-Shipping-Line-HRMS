import bcrypt from 'bcryptjs';

export const hashPassword = (plain) => bcrypt.hash(plain, 10);

// Passwords created outside the app (e.g. the seed rows in zam_hrms.sql) may be plain text.
// They are accepted once and immediately re-stored as a bcrypt hash by the auth service.
export const isBcrypt = (stored) => /^\$2[aby]\$/.test(stored || '');

export const verifyPassword = async (plain, stored) =>
  isBcrypt(stored) ? bcrypt.compare(plain, stored) : plain === stored;
