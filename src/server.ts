import dotenv from 'dotenv';
import path from 'path';
import clientsRouter from './routes/clients';
import { createBaseApp } from './shared/createBaseApp';
import pool from './config/database';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const auditLogger = async (entry: {
  serviceName: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  userId?: number | null;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await pool.query(
      `INSERT INTO system_audit_logs (
        service_name, method, path, status_code, duration_ms, user_id, ip_address, user_agent, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        entry.serviceName,
        entry.method,
        entry.path,
        entry.statusCode,
        entry.durationMs,
        entry.userId ?? null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
        JSON.stringify(entry.metadata ?? {}),
      ]
    );
  } catch (error) {
    console.error('Erro ao salvar log de auditoria:', error);
  }
};

const app = createBaseApp({ serviceName: 'clients-service', auditLogger });

app.use('/api/clients', clientsRouter);

const PORT = process.env.PORT || 3335;
app.listen(PORT, () => {
  console.log(`Clients Service rodando na porta ${PORT}`);
});
