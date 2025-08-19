cat > debug.js << EOF
const { Pool } = require('pg');

const pool = new Pool({
    user: 'alexandre',
    host: 'localhost',
    database: 'pedidos',
    password: 'alex123',
    port: 5432
});

async function test() {
    const client = await pool.connect();
    try {
        console.log('✅ Conexão com PostgreSQL estabelecida!');
        const res = await client.query('SELECT NOW()');
        console.log('Hora do banco:', res.rows[0].now);
    } catch (err) {
        console.error('❌ Erro na conexão:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

test();
EOF