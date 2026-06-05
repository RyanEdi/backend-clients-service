/**
 * Criptografia AES-256-CBC para dados sensíveis de clientes (LGPD)
 *
 * Formato do valor cifrado: 'enc:<ivHex>:<cipherHex>'
 * O prefixo 'enc:' permite distinguir valores já cifrados de texto legado.
 */
import crypto from 'crypto';

const getKey = (): Buffer => {
  const secret = process.env.DATA_SECRET;
  if (!secret) throw new Error('DATA_SECRET não definido no .env');
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Cifra um valor string com AES-256-CBC.
 * Retorna string no formato 'enc:<ivHex>:<cipherHex>'.
 */
export const encryptField = (value: string): string => {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(value, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `enc:${iv.toString('hex')}:${encrypted}`;
};

/**
 * Decifra um valor 'enc:...' e retorna o texto original.
 * Se o valor não tiver o prefixo 'enc:' (dados legado em texto claro),
 * retorna o valor como está — compatibilidade retroativa.
 */
export const decryptField = (value: string): string => {
  if (!value || !value.startsWith('enc:')) return value;
  try {
    const key = getKey();
    const rest = value.slice(4); // remove 'enc:'
    const colonIdx = rest.indexOf(':');
    const ivHex = rest.slice(0, colonIdx);
    const data = rest.slice(colonIdx + 1);
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return value; // retorno de seguranca em caso de falha na decifragem
  }
};

/**
 * Cifra um valor se presente. Preserva:
 * - undefined → undefined  (campo não enviado, não atualiza no PATCH)
 * - null / ''  → null       (limpar campo)
 * - string     → 'enc:...'  (cifrado)
 */
export const encryptIfPresent = (
  value: string | null | undefined
): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return encryptField(value);
};

/**
 * Decifra um valor se presente. Retorna null para null/undefined.
 */
export const decryptIfPresent = (value: string | null | undefined): string | null => {
  if (value == null) return null;
  return decryptField(value);
};
