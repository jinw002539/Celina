require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');

// Configuração do PostgreSQL para Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Teste de conexão ao iniciar
pool.query('SELECT NOW()')
    .then(() => console.log('✅ PostgreSQL conectado'))
    .catch(err => {
        console.error('❌ Erro PostgreSQL:', err);
        process.exit(1);
    });

const app = express();
app.use(cors());
app.use(express.json());

// Servir arquivos estáticos
// app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname)));

// Rota de saúde
app.get('/health', (req, res) => {
    res.json({ status: 'online', db: pool ? 'connected' : 'disconnected' });
});

// Rota de pedidos
app.post('/pedido', async(req, res) => {
    try {
        const { rows } = await pool.query(
            `INSERT INTO pedidos (nome, contato, bairro, produtos, total)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       RETURNING id`, [
                req.body.nome,
                req.body.contato,
                req.body.bairro,
                JSON.stringify(req.body.produtos),
                req.body.total
            ]
        );
        res.status(201).json({ id: rows[0].id });
    } catch (err) {
        console.error('Erro no pedido:', err);
        res.status(500).json({ error: err.message });
    }
});

// Rota para todas as páginas HTML
// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../public', 'index.html'));
// });
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Mantém o processo ativo
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
    console.error('Erro não tratado:', err);
    server.close(() => process.exit(1));
});