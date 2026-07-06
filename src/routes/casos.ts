import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/database';
import { sanitizeText } from '../utils/sanitizers';

const router = Router();

const getUserId = (req: Request): number | null => {
  const raw = req.headers['x-user-id'];
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/casos — Lista de casos com depuração detalhada
router.get('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    // Tentativa de busca simples na tabela casos_adv
    const query = `SELECT * FROM casos_adv WHERE advogado_id = $1`;
    const result = await pool.query(query, [advogadoId]);
    
    return res.json(result.rows);
  } catch (err: any) {
    // LOG DETALHADO: Isso aparecerá no painel da Railway
    console.error('[ERRO_BANCO] Falha na query de casos_adv:', {
      message: err.message,
      code: err.code, // Ex: '42P01' (tabela não existe) ou '42703' (coluna não existe)
      detail: err.detail
    });
    return res.status(500).json({ 
      error: 'Erro interno ao buscar casos.',
      detalhe: err.message 
    });
  }
});

// POST /api/casos — Criação de caso
router.post('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  const { clienteId, tipo, dataAbertura, prazo, status, observacoes } = req.body;

  try {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO casos_adv (id, advogado_id, cliente_id, tipo, status, data_abertura, prazo, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, advogadoId, clienteId || null, sanitizeText(tipo), status || 'ativo', dataAbertura, prazo || null, observacoes ? sanitizeText(observacoes) : null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('[ERRO_BANCO] Falha no INSERT:', err.message);
    return res.status(500).json({ error: 'Erro ao criar caso.', detalhe: err.message });
  }
});

// PATCH /api/casos/:id — Atualização
router.patch('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  const { clienteId, tipo, dataAbertura, prazo, status, observacoes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE casos_adv SET cliente_id = $1, tipo = $2, data_abertura = $3, prazo = $4, status = $5, observacoes = $6
       WHERE id = $7 AND advogado_id = $8 RETURNING *`,
      [clienteId || null, tipo ? sanitizeText(tipo) : null, dataAbertura || null, prazo || null, status || null, observacoes ? sanitizeText(observacoes) : null, req.params.id, advogadoId]
    );
    return res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[ERRO_BANCO] Falha no UPDATE:', err.message);
    return res.status(500).json({ error: 'Erro ao atualizar.', detalhe: err.message });
  }
});

export default router;