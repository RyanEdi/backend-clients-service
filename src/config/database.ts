import dotenv from 'dotenv';
import path from 'path';
import { Pool } from 'pg';

// Carrega .env da pasta raiz do projeto
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Configuração do Banco de Dados PostgreSQL via .env
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Teste de conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', err => {
  console.error('❌ Erro na conexão com PostgreSQL:', err);
});

export default pool;
