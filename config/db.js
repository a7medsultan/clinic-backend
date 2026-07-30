const mysql = require('mysql2');
require('dotenv').config(); // Loads variables from our .env file

// Create a pool of connections to the database
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // Max simultaneous connections to keep open
    queueLimit: 0
});

// Convert the pool to use Promises so we can use modern async/await syntax
const db = pool.promise();

module.exports = db;