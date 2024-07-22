// db.js
const sql = require('mssql');

const config = {
    server: '172.16.1.19\\SYSPRO8', 
    database:'SysproCompanyA',
    //driver:'msnodesqlv8',
     user:'sa',
    password:'syspro',
    options: {
     encrypt: false,
       trustConnection: true, 
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
    },

       
};


async function getSalesData() {
    try {
        await sql.connect(config);
        const result = await sql.query`SELECT TOP (1000) [AccountType]
        ,[Description]
        ,[TimeStamp]
    FROM [SysproCompanyA].[dbo].[CrmAccountType]
   `;
        return result.recordset;
    } catch (err) {
        console.error('SQL error', err);
        throw err;
    }
}

module.exports = {
    getSalesData,
};
