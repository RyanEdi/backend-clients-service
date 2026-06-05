import dotenv from 'dotenv';
import path from 'path';
import clientsRouter from '../routes/clients';
import casosRouter from '../routes/casos';
import peticoesRouter from '../routes/peticoes';
import eventosRouter from '../routes/eventos';
import { createBaseApp } from '../shared/createBaseApp';
import { resolvePort } from '../config/http';
import pool from '../config/database';

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
app.use('/api/casos', casosRouter);
app.use('/api/peticoes', peticoesRouter);
app.use('/api/eventos', eventosRouter);


// Rota raiz (deve ser a ultima rota para evitar conflitos)


app.get('/health', (_req, res) => {
  res.json({ service: 'clients-service', status: 'ok' });
});

const PORT = resolvePort('CLIENTS_SERVICE_PORT', 3335);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Clients service running on port ${PORT}`);
  });
}

export default app;
