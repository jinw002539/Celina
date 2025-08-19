const { Pool } = require('pg');

const pool = new Pool({
    user: 'alexandre',
    host: 'localhost',
    database: 'pedidos',
    password: 'alex123',
    port: 5432
});

module.exports = pool;