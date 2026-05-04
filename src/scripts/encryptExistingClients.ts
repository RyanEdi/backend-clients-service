/**
 * Script de migração: cifra os dados PII de todos os clientes existentes no banco.
 *
 * Execução:
 *   npx tsx src/scripts/encryptExistingClients.ts
 *   ou após build:
 *   node -e "require('./dist/scripts/encryptExistingClients.js')"
 *
 * É seguro executar múltiplas vezes — valores já cifrados (prefixo 'enc:') são ignorados.
 */
import dotenv from 'dotenv';
import path from 'path';
import pool from '../config/database';
import { encryptField } from '../utils/crypto';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PII_COLUMNS = [
  'nome_completo',
  'cpf',
  'email',
  'telefone',
  'rg',
  'cep',
  'endereco_completo',
  'cidade_uf',
  'data_nascimento',
] as const;

async function migrateEncrypt(): Promise<void> {
  console.log('🔐 Iniciando migração de criptografia de dados sensíveis...');

  const result = await pool.query(
    `SELECT id, ${PII_COLUMNS.join(', ')} FROM clientes_adv`
  );

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of result.rows) {
    // Verifica se já está cifrado (usa o campo nome_completo como indicador)
    if (row.nome_completo && String(row.nome_completo).startsWith('enc:')) {
      skipped++;
      continue;
    }

    const setClauses: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    for (const col of PII_COLUMNS) {
      const raw = row[col];
      if (raw !== null && raw !== undefined) {
        const plaintext = String(raw);
        if (plaintext && !plaintext.startsWith('enc:')) {
          setClauses.push(`${col} = $${idx}`);
          values.push(encryptField(plaintext));
          idx++;
        }
      }
    }

    if (setClauses.length === 0) {
      skipped++;
      continue;
    }

    values.push(row.id);
    try {
      await pool.query(
        `UPDATE clientes_adv SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values
      );
      encrypted++;
    } catch (err) {
      console.error(`  ❌ Erro no cliente ${row.id}:`, err);
      errors++;
    }
  }

  console.log(`\n✅ Migração concluída:`);
  console.log(`   ${encrypted} clientes cifrados`);
  console.log(`   ${skipped} já cifrados ou sem dados`);
  if (errors > 0) console.log(`   ${errors} erros (verifique acima)`);

  await pool.end();
}

migrateEncrypt().catch(err => {
  console.error('❌ Falha na migração:', err);
  process.exit(1);
});
