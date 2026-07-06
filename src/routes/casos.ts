import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import pool from '../config/database';
import { sanitizeText } from '../utils/sanitizers';

const router = Router();

// Função auxiliar para verificar o ID do advogado logado
const getUserId = (req: Request): number | null => {
  const raw = req.headers['x-user-id'];
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// GET /api/casos — lista casos do advogado
router.get('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `SELECT
          c.id,
          c.cliente_id AS "clienteId",
          cl.nome_completo AS "clienteNome",
          c.tipo,
          c.status,
          c.data_abertura AS "dataAbertura",
          c.prazo,
          c.observacoes,
          c.created_at AS "createdAt"
        FROM casos_adv c
        LEFT JOIN clientes_adv cl ON cl.id = c.cliente_id
        WHERE c.advogado_id = $1
        ORDER BY c.created_at DESC`,
      [advogadoId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('[casos] GET /', err);
    return res.status(500).json({ error: 'Erro ao listar casos.' });
  }
});

// GET /api/casos/:id — detalhe de um caso
router.get('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `SELECT c.*, cl.nome_completo AS "clienteNome"
       FROM casos_adv c
       LEFT JOIN clientes_adv cl ON cl.id = c.cliente_id
       WHERE c.id = $1 AND c.advogado_id = $2`,
      [req.params.id, advogadoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Caso não encontrado.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[casos] GET /:id', err);
    return res.status(500).json({ error: 'Erro ao buscar caso.' });
  }
});

// POST /api/casos — criar caso
router.post('/', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  const { clienteId, tipo, dataAbertura, prazo, status, observacoes } = req.body;

  if (!tipo || !dataAbertura) {
    return res.status(400).json({ error: 'Tipo e data de abertura são obrigatórios.' });
  }

  try {
    const id = uuid();
    const result = await pool.query(
      `INSERT INTO casos_adv (id, advogado_id, cliente_id, tipo, status, data_abertura, prazo, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        advogadoId,
        clienteId || null,
        sanitizeText(tipo),
        status || 'ativo',
        dataAbertura,
        prazo || null,
        observacoes ? sanitizeText(observacoes) : null,
      ]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[casos] POST /', err);
    return res.status(500).json({ error: 'Erro ao criar caso.' });
  }
});

// PATCH /api/casos/:id — atualizar caso
router.patch('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  const { clienteId, tipo, dataAbertura, prazo, status, observacoes } = req.body;

  try {
    // Atualiza explicitamente os campos fornecidos ou define como NULL se não informados
    const result = await pool.query(
      `UPDATE casos_adv SET
          cliente_id = $1,
          tipo = $2,
          data_abertura = $3,
          prazo = $4,
          status = $5,
          observacoes = $6,
          updated_at = NOW()
       WHERE id = $7 AND advogado_id = $8
       RETURNING *`,
      [
        clienteId || null,
        tipo ? sanitizeText(tipo) : null,
        dataAbertura || null,
        prazo || null,
        status || null,
        observacoes !== undefined ? sanitizeText(String(observacoes)) : null,
        req.params.id,
        advogadoId,
      ]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Caso não encontrado.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('[casos] PATCH /:id', err);
    return res.status(500).json({ error: 'Erro ao atualizar caso.' });
  }
});

// DELETE /api/casos/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const advogadoId = getUserId(req);
  if (!advogadoId) return res.status(401).json({ error: 'Não autorizado.' });

  try {
    const result = await pool.query(
      `DELETE FROM casos_adv WHERE id = $1 AND advogado_id = $2 RETURNING id`,
      [req.params.id, advogadoId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Caso não encontrado.' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[casos] DELETE /:id', err);
    return res.status(500).json({ error: 'Erro ao excluir caso.' });
  }
});

export default router;