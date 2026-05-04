import express from 'express';
import clientsRouter from './routes/clients';

const app = express();
app.use(express.json());

// Registra as rotas de clientes em /api/clients
app.use('/api/clients', clientsRouter);

const PORT = process.env.PORT || 3335;
app.listen(PORT, () => {
  console.log(`Clients Service rodando na porta ${PORT}`);
});
