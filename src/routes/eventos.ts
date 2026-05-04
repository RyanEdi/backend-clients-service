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

// GET /api/eventos
router.get('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `SELECT id, titulo, tipo, data, hora, cliente_associado AS "clienteAssociado",
              numero_caso AS "numeroCaso", local, observacoes, created_at AS "createdAt"
       FROM eventos_adv
       WHERE advogado_id = $1
       ORDER BY data ASC, hora ASC NULLS LAST`,
      [advogadoId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[eventos] GET /', err);
    return res.status(500).json({ error: 'Erro ao listar eventos.' });
  }
});

// GET /api/eventos/:id
router.get('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `SELECT * FROM eventos_adv WHERE id = $1 AND advogado_id = $2`,
      [req.params.id, advogadoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Evento não encontrado.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[eventos] GET /:id', err);
    return res.status(500).json({ error: 'Erro ao buscar evento.' });
  }
});

// POST /api/eventos
router.post('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  const { titulo, tipo, data, hora, clienteAssociado, numeroCaso, local, observacoes } = req.body;

  if (!titulo || !data) {
    return res.status(400).json({ error: 'Título e data são obrigatórios.' });
  }

  try {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO eventos_adv (id, advogado_id, titulo, tipo, data, hora, cliente_associado, numero_caso, local, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        advogadoId,
        sanitizeText(titulo),
        sanitizeText(tipo || 'outro'),
        data,
        hora || null,
        clienteAssociado ? sanitizeText(clienteAssociado) : null,
        numeroCaso ? sanitizeText(numeroCaso) : null,
        local ? sanitizeText(local) : null,
        observacoes ? sanitizeText(observacoes) : null,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[eventos] POST /', err);
    return res.status(500).json({ error: 'Erro ao criar evento.' });
  }
});

// DELETE /api/eventos/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `DELETE FROM eventos_adv WHERE id = $1 AND advogado_id = $2 RETURNING id`,
      [req.params.id, advogadoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Evento não encontrado.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[eventos] DELETE /:id', err);
    return res.status(500).json({ error: 'Erro ao excluir evento.' });
  }
});

export default router;
