/**
 * GET /api/hr/test-db
 * Tests MySQL connection and returns status.
 * DELETE THIS FILE after connection is confirmed working.
 */
const { setCors, handleOptions } = require('../_lib/cors');
const { query } = require('../_lib/mysql');

const TABLE = process.env.MYSQL_TABLE_EMPLOYEES || 'user';

module.exports = async (req, res) => {
  setCors(res);
  if (handleOptions(req, res)) return;

  const result = {
    env: {
      MYSQL_HOST:     process.env.MYSQL_HOST     ? '✅ Set' : '❌ Missing',
      MYSQL_PORT:     process.env.MYSQL_PORT      ? '✅ Set' : '⚠️ Not set (will use 3306)',
      MYSQL_USER:     process.env.MYSQL_USER     ? '✅ Set' : '❌ Missing',
      MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? '✅ Set' : '❌ Missing',
      MYSQL_DATABASE: process.env.MYSQL_DATABASE ? '✅ Set' : '❌ Missing',
      MYSQL_TABLE_EMPLOYEES: process.env.MYSQL_TABLE_EMPLOYEES ? `✅ Set (${TABLE})` : `⚠️ Not set (will use "user")`,
    },
    connection: null,
    query:      null,
    error:      null,
  };

  // Step 1 — check env vars
  if (!process.env.MYSQL_HOST || !process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) {
    result.connection = '❌ Cannot connect — missing env variables above';
    return res.status(200).json(result);
  }

  // Step 2 — try connecting
  try {
    await query('SELECT 1');
    result.connection = '✅ Connected successfully';
  } catch (err) {
    result.connection = '❌ Connection failed';
    result.error = err.message;
    return res.status(200).json(result);
  }

  // Step 3 — try reading the employee table
  try {
    const rows = await query(`SELECT COUNT(*) AS total FROM \`${TABLE}\``);
    result.query = `✅ Table "${TABLE}" found — ${rows[0].total} rows`;
  } catch (err) {
    result.query = `❌ Could not read table "${TABLE}"`;
    result.error = err.message;
  }

  return res.status(200).json(result);
};
