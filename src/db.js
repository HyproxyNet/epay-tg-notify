const mysql = require("mysql2/promise");

function tableName(prefix, name) {
  return `\`${prefix}_${name}\``;
}

function createPoolFromConfig(config) {
  return mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    decimalNumbers: true,
  });
}

async function withTransaction(pool, handler) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createPoolFromConfig,
  tableName,
  withTransaction,
};
