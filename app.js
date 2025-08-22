require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const basicAuth = require('basic-auth');

// Configuração do PostgreSQL para Render
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ⚡ VERIFICAÇÃO AUTOMÁTICA DA TABELA
async function inicializarBanco() {
    let client;
    try {
        client = await pool.connect();
        console.log('🔍 Verificando se tabela pedidos existe...');

        const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'pedidos'
      );
    `);

        if (!result.rows[0].exists) {
            console.log('📦 Criando tabela pedidos...');
            await client.query(`
        CREATE TABLE pedidos (
          id SERIAL PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          contato VARCHAR(20) NOT NULL,
          bairro VARCHAR(50) NOT NULL,
          produtos JSONB NOT NULL,
          total INTEGER NOT NULL,
          data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
            console.log('✅ Tabela pedidos criada com sucesso!');
        } else {
            console.log('✅ Tabela pedidos já existe');
        }
    } catch (err) {
        console.error('❌ Erro ao verificar/criar tabela:', err);
    } finally {
        if (client) client.release();
    }
}

inicializarBanco();

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
app.use(express.static(path.join(__dirname)));

// 🔐 MIDDLEWARE DE AUTENTICAÇÃO
const auth = (req, res, next) => {
    const credentials = basicAuth(req);

    if (!credentials || credentials.name !== 'admin' || credentials.pass !== 'r00t') {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('Acesso não autorizado');
    }

    next();
};

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

// 📊 ROTAS ADMIN (PROTEGIDAS)
app.get('/admin/pedidos', auth, async(req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM pedidos ORDER BY data_criacao DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/admin/stats', auth, async(req, res) => {
    try {
        const totalResult = await pool.query('SELECT COUNT(*) FROM pedidos');
        const revenueResult = await pool.query('SELECT SUM(total) FROM pedidos');

        res.json({
            totalPedidos: parseInt(totalResult.rows[0].count),
            receitaTotal: parseInt(revenueResult.rows[0].sum || 0),
            dataConsulta: new Date().toLocaleString('pt-BR')
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🖥️ PÁGINA ADMIN (PROTEGIDA)
app.get('/admin', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Rota para debug público
app.get('/debug', async(req, res) => {
    try {
        const result = await pool.query('SELECT COUNT(*) FROM pedidos');
        res.json({ totalPedidos: result.rows[0].count });
    } catch (err) {
        res.json({ error: err.message });
    }
});

// Rota para todas as páginas HTML
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