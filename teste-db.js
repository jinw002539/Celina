// const { Pool } = require('pg');

// const pool = new Pool({
//   user: 'alexandre',
//   host: 'localhost',
//   database: 'pedidos',
//   password: 'alex123',
//   port: 5432,
// });

// async function test() {
//   try {
//     const res = await pool.query('INSERT INTO pedidos(nome, contato, bairro, produtos, total) VALUES($1, $2, $3, $4, $5) RETURNING *', [
//       'Teste Direto',
//       '841234567',
//       'Bairro Teste',
//       [{"nome": "Queijo", "preco": 300, "qtd": 1}],
//       300
//     ]);
//     console.log('Sucesso!', res.rows[0]);
//   } catch (err) {
//     console.error('Erro detalhado:', err);
//   } finally {
//     await pool.end();
//   }
// }

// test();
//------------------------------------------
const { Pool } = require('pg');

const pool = new Pool({
    user: 'alexandre',
    host: 'localhost',
    database: 'pedidos',
    password: 'alex123',
    port: 5432,
});

async function test() {
    const client = await pool.connect();
    try {
        const produtos = [{ nome: "Queijo", preco: 300, qtd: 1 }];
        const res = await client.query(
            `INSERT INTO pedidos(nome, contato, bairro, produtos, total) 
       VALUES($1, $2, $3, $4::json, $5) 
       RETURNING *`, [
                'Teste Direto',
                '841234567',
                'Bairro Teste',
                JSON.stringify(produtos), // Convertendo explicitamente
                300
            ]
        );
        console.log('Sucesso!', res.rows[0]);
    } catch (err) {
        console.error('Erro detalhado:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

test();