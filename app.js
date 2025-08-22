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

// 🔐 MIDDLEWARE DE AUTENTICAÇÃO
const auth = (req, res, next) => {
    const credentials = basicAuth(req);

    if (!credentials || credentials.name !== 'admin' || credentials.pass !== 'r00t') {
        res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
        return res.status(401).send('Acesso não autorizado');
    }

    next();
};

const app = express();
app.use(cors());
app.use(express.json());

// ✅ 1. ROTAS DE API ( devem vir ANTES do express.static )
app.get('/health', (req, res) => {
    res.json({ status: 'online', db: 'connected' });
});

app.post('/pedido', async(req, res) => {
    let client;
    try {
        client = await pool.connect();
        const { rows } = await client.query(
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
    } finally {
        if (client) client.release();
    }
});

// ✅ 2. ROTAS ADMIN (PROTEGIDAS)
app.get('/admin/pedidos', auth, async(req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT * FROM pedidos ORDER BY data_criacao DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar pedidos:', err);
        res.status(500).json({ error: 'Erro ao carregar pedidos' });
    } finally {
        if (client) client.release();
    }
});

app.get('/admin/stats', auth, async(req, res) => {
    let client;
    try {
        client = await pool.connect();
        const totalResult = await client.query('SELECT COUNT(*) FROM pedidos');
        const revenueResult = await client.query('SELECT SUM(total) FROM pedidos');

        res.json({
            totalPedidos: parseInt(totalResult.rows[0].count || 0),
            receitaTotal: parseInt(revenueResult.rows[0].sum || 0),
            dataConsulta: new Date().toLocaleString('pt-BR')
        });
    } catch (err) {
        console.error('Erro ao buscar estatísticas:', err);
        res.json({
            totalPedidos: 0,
            receitaTotal: 0,
            dataConsulta: new Date().toLocaleString('pt-BR')
        });
    } finally {
        if (client) client.release();
    }
});

app.get('/admin', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ✅ 3. ROTAS PÚBLICAS DE DEBUG
app.get('/debug', async(req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT COUNT(*) FROM pedidos');
        res.json({ totalPedidos: result.rows[0].count, status: 'success' });
    } catch (err) {
        res.json({ totalPedidos: 0, status: 'error', error: err.message });
    } finally {
        if (client) client.release();
    }
});

app.get('/check-table', async(req, res) => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'pedidos'
            );
        `);
        res.json({ tabelaExiste: result.rows[0].exists });
    } catch (err) {
        res.json({ tabelaExiste: false, error: err.message });
    } finally {
        if (client) client.release();
    }
});

// ✅ 4. SERVIR ARQUIVOS ESTÁTICOS (depois das rotas específicas)
app.use(express.static(path.join(__dirname)));

// ✅ 5. ROTA CURINGA PARA SPA (por ÚLTIMO)
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