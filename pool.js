const sql = require('mssql');
const dbConfig = require('./db');

const poolPromise = new sql.ConnectionPool(dbConfig)
    .connect()
    .then(pool => {
        console.log('Connected to SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('Database Connection Failed - Error:', err);
        throw err;
    });

module.exports = {
    sql,
    poolPromise,
};
