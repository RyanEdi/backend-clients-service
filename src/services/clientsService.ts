import dotenv from 'dotenv';
import path from 'path';
import clientsRouter from '../routes/clients';
import casosRouter from '../routes/casos';
import peticoesRouter from '../routes/peticoes';
import eventosRouter from '../routes/eventos';
import { createBaseApp } from '../shared/createBaseApp';
import { resolvePort } from '../config/http';
import { runMigrations } from '../config/database';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = createBaseApp();

app.use('/api/clients', clientsRouter);
app.use('/api/casos', casosRouter);
app.use('/api/peticoes', peticoesRouter);
app.use('/api/eventos', eventosRouter);


// Root route handler (deve ser a última rota para evitar conflitos)


app.get('/health', (_req, res) => {
  res.json({ service: 'clients-service', status: 'ok' });
});

const PORT = resolvePort('CLIENTS_SERVICE_PORT', 3335);

if (require.main === module) {
  runMigrations().then(() => {
    app.listen(PORT, () => {
      console.log(`Clients service running on port ${PORT}`);
    });
  });
}

export default app;
