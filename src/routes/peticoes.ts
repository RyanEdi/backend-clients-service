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

// GET /api/peticoes
router.get('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `SELECT id, cliente, tipo, numero_caso AS "numeroCaso", data_documento AS "dataDocumento",
              status, created_at AS "createdAt"
       FROM peticoes_adv
       WHERE advogado_id = $1
       ORDER BY created_at DESC`,
      [advogadoId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[peticoes] GET /', err);
    return res.status(500).json({ error: 'Erro ao listar petições.' });
  }
});

// GET /api/peticoes/:id
router.get('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `SELECT * FROM peticoes_adv WHERE id = $1 AND advogado_id = $2`,
      [req.params.id, advogadoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Petição não encontrada.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[peticoes] GET /:id', err);
    return res.status(500).json({ error: 'Erro ao buscar petição.' });
  }
});

// POST /api/peticoes
router.post('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  const { cliente, tipo, numeroCaso, dataDocumento, conteudo, status } = req.body;

  if (!tipo) {
    return res.status(400).json({ error: 'Tipo de petição é obrigatório.' });
  }

  try {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO peticoes_adv (id, advogado_id, cliente, tipo, numero_caso, data_documento, conteudo, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        advogadoId,
        cliente ? sanitizeText(cliente) : null,
        sanitizeText(tipo),
        numeroCaso ? sanitizeText(numeroCaso) : null,
        dataDocumento || null,
        conteudo ? sanitizeText(conteudo) : null,
        status || 'rascunho',
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[peticoes] POST /', err);
    return res.status(500).json({ error: 'Erro ao criar petição.' });
  }
});

// DELETE /api/peticoes/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `DELETE FROM peticoes_adv WHERE id = $1 AND advogado_id = $2 RETURNING id`,
      [req.params.id, advogadoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Petição não encontrada.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[peticoes] DELETE /:id', err);
    return res.status(500).json({ error: 'Erro ao excluir petição.' });
  }
});

export default router;
