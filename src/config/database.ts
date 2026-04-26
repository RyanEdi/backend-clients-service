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

// Função para executar migrações automáticas
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Executando migrações do banco de dados...');

    // Migração 1: Adicionar coluna 'ativo' se não existir
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'usuarios_adv' AND column_name = 'ativo'
        ) THEN
          ALTER TABLE usuarios_adv ADD COLUMN ativo BOOLEAN DEFAULT TRUE;
          RAISE NOTICE 'Coluna ativo adicionada com sucesso';
        END IF;
      END $$;
    `);

    // Migração 2: Criar tabela de clientes vinculada ao advogado
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes_adv (
        id VARCHAR(36) PRIMARY KEY,
        advogado_id INTEGER NOT NULL,
        nome_completo VARCHAR(200) NOT NULL,
        cpf VARCHAR(20) NOT NULL,
        cpf_hash VARCHAR(255) NOT NULL,
        dados_sensiveis_hash JSONB DEFAULT '{}'::jsonb,
        email VARCHAR(150),
        email_hash VARCHAR(255),
        telefone VARCHAR(25),
        telefone_hash VARCHAR(255),
        cep VARCHAR(12),
        endereco_completo TEXT,
        estado_civil VARCHAR(50),
        data_nascimento DATE,
        profissao VARCHAR(100),
        rg VARCHAR(30),
        rg_hash VARCHAR(255),
        cidade_uf VARCHAR(100),
        contribuicao_mensal VARCHAR(50),
        valor_dano_moral VARCHAR(50),
        valor_da_causa VARCHAR(50),
        possui_deficiencia BOOLEAN DEFAULT FALSE,
        tipo_deficiencia VARCHAR(30),
        data_laudo DATE,
        cid VARCHAR(20),
        grau_deficiencia_ifbra VARCHAR(20),
        documento_comprobatorio_nome VARCHAR(255),
        sexo_previdenciario VARCHAR(20),
        calculo_previdenciario JSONB DEFAULT '{}'::jsonb,
        observacoes_juridicas TEXT,
        endereco_escritorio TEXT,
        endereco_df_iprev TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS advogado_id INTEGER;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS nome_completo VARCHAR(200);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS cpf VARCHAR(20);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS cpf_hash VARCHAR(255);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS dados_sensiveis_hash JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS email VARCHAR(150);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS email_hash VARCHAR(255);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS telefone VARCHAR(25);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS telefone_hash VARCHAR(255);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS cep VARCHAR(12);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS endereco_completo TEXT;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS estado_civil VARCHAR(50);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS data_nascimento DATE;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS profissao VARCHAR(100);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS rg VARCHAR(30);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS rg_hash VARCHAR(255);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS cidade_uf VARCHAR(100);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS contribuicao_mensal VARCHAR(50);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS valor_dano_moral VARCHAR(50);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS valor_da_causa VARCHAR(50);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS possui_deficiencia BOOLEAN DEFAULT FALSE;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS tipo_deficiencia VARCHAR(30);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS data_laudo DATE;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS cid VARCHAR(20);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS grau_deficiencia_ifbra VARCHAR(20);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS documento_comprobatorio_nome VARCHAR(255);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS sexo_previdenciario VARCHAR(20);
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS calculo_previdenciario JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS observacoes_juridicas TEXT;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS endereco_escritorio TEXT;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS endereco_df_iprev TEXT;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE clientes_adv ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes_adv_periodos (
        id SERIAL PRIMARY KEY,
        cliente_id VARCHAR(36) NOT NULL,
        tipo VARCHAR(30) NOT NULL,
        data_inicio DATE,
        data_fim DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_clientes_adv_periodos_cliente'
        ) THEN
          ALTER TABLE clientes_adv_periodos
            ADD CONSTRAINT fk_clientes_adv_periodos_cliente
            FOREIGN KEY (cliente_id)
            REFERENCES clientes_adv(id)
            ON DELETE CASCADE;
        END IF;
      END $$;
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_clientes_adv_advogado'
        ) THEN
          ALTER TABLE clientes_adv
            ADD CONSTRAINT fk_clientes_adv_advogado
            FOREIGN KEY (advogado_id)
            REFERENCES usuarios_adv(id)
            ON DELETE RESTRICT;
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_clientes_adv_advogado_id ON clientes_adv(advogado_id);
      CREATE INDEX IF NOT EXISTS idx_clientes_adv_created_at ON clientes_adv(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_clientes_adv_periodos_cliente_id ON clientes_adv_periodos(cliente_id);
    `);

    console.log('✅ Migrações executadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error);
    // Não lança erro para não impedir o servidor de iniciar
  }
}

export default pool;
