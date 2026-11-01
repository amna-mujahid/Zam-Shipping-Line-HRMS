// MySQL connection pool and transaction helper.
import mysql from 'mysql2/promise';
import { env } from './env.js';

export const dbConfig = env.db;

export const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true, // DATE → 'YYYY-MM-DD', TIME → 'HH:MM:SS', no timezone shifting
  decimalNumbers: true,
});

export const withTransaction = async (fn) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const checkConnection = () => pool.query('select 1 from employees limit 1');
