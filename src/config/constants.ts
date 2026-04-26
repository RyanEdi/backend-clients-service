/**
 * Constantes da aplicação
 */

// Número de rounds para o bcrypt (quanto maior, mais seguro e mais lento)
export const SALT_ROUNDS = 12;

// CPFs de administradores (lido do .env, separados por vírgula)
export const ADMIN_CPFS = (process.env.ADMIN_CPFS || '')
  .split(',')
  .map(cpf => cpf.trim())
  .filter(Boolean);
