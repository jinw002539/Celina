const { Pool } = require('pg');

async function initDB() {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await pool.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        contato VARCHAR(20) NOT NULL,
        bairro VARCHAR(50) NOT NULL,
        produtos JSONB NOT NULL,
        total INTEGER NOT NULL,
        data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('✅ Tabela pedidos criada/verificada');
    } catch (err) {
        console.error('❌ Erro ao criar tabela:', err);
    } finally {
        await pool.end();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    initDB();
}

module.exports = initDB;