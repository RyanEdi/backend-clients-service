import { Router, Request, Response } from 'express';

import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import pool from '../config/database';
import { SALT_ROUNDS } from '../config/constants';
import { sanitizeText } from '../utils/sanitizers';
import { encryptField, encryptIfPresent, decryptField } from '../utils/crypto';

const router = Router();

type PeriodoPayload = {
  tipo?: string;
  inicio?: string;
  fim?: string;
};

type SensitiveSnapshotInput = {
  name?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  email?: string | null;
  phone?: string | null;
  zipCode?: string | null;
  address?: string | null;
  estadoCivil?: string | null;
  profissao?: string | null;
  rg?: string | null;
  cidadeUf?: string | null;
  contribuicaoMensal?: string | null;
  valorDanoMoral?: string | null;
  valorDaCausa?: string | null;
  possuiDeficiencia?: boolean | null;
  tipoDeficiencia?: string | null;
  dataLaudo?: string | null;
  cid?: string | null;
  grauDeficienciaIfbra?: string | null;
  documentoComprobatorioNome?: string | null;
  sexoPrevidenciario?: string | null;
  calculoPrevidenciario?: Record<string, unknown> | null;
  observacoesJuridicas?: string | null;
  enderecoEscritorio?: string | null;
  enderecoDfIprev?: string | null;
  periodos?: PeriodoPayload[];
};

const sanitizePeriodos = (raw: unknown): PeriodoPayload[] => {
  if (!Array.isArray(raw)) return [];
  const sanitized: PeriodoPayload[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const periodo = item as Record<string, unknown>;
    const tipo = sanitizeText(String(periodo.tipo ?? ''));
    if (!tipo) continue;

    const inicio = sanitizeText(String(periodo.inicio ?? ''));
    const fim = sanitizeText(String(periodo.fim ?? ''));

    sanitized.push({
      tipo,
      inicio: inicio || undefined,
      fim: fim || undefined,
    });
  }
  return sanitized;
};

const sanitizeOptionalText = (raw: unknown): string | undefined => {
  if (raw === undefined || raw === null) return undefined;
  const sanitized = sanitizeText(String(raw));
  if (!sanitized) return undefined;
  if (sanitized.toLowerCase() === 'null') return undefined;
  if (sanitized.toLowerCase() === 'undefined') return undefined;
  return sanitized;
};

const mapClientFields = (body: Record<string, any>) => {
  const rawName = body.name ?? body.nomeAutor ?? body.nome_completo;
  const rawCpf = body.cpf;
  const rawDataNascimento = body.dataNascimento ?? body.data_nascimento;
  const rawEmail = body.email ?? body.emailAutor;
  const rawPhone = body.phone ?? body.telefone;
  const rawZipCode = body.zipCode ?? body.cep;
  const rawAddress = body.address ?? body.enderecoCompleto;
  const rawEstadoCivil = body.estadoCivil;
  const rawProfissao = body.profissao;
  const rawRg = body.rg;
  const rawCidadeUf = body.cidadeUf;
  const rawContribuicaoMensal = body.contribuicaoMensal;
  const rawValorDanoMoral = body.valorDanoMoral;
  const rawValorDaCausa = body.valorDaCausa;
  const rawPossuiDeficiencia = body.possuiDeficiencia;
  const rawTipoDeficiencia = body.tipoDeficiencia;
  const rawDataLaudo = body.dataLaudo;
  const rawCid = body.cid;
  const rawGrauDeficienciaIfbra = body.grauDeficienciaIfbra;
  const rawDocumentoComprobatorioNome = body.documentoComprobatorioNome;
  const rawSexoPrevidenciario = body.sexoPrevidenciario;
  const rawCalculoPrevidenciario = body.calculoPrevidenciario;
  const rawObservacoesJuridicas = body.observacoesJuridicas;
  const rawEnderecoEscritorio = body.enderecoEscritorio;
  const rawEnderecoDfIprev = body.enderecoDfIprev;
  const rawPeriodos = body.periodos;

  return {
    name: sanitizeOptionalText(rawName),
    cpf: sanitizeOptionalText(rawCpf),
    dataNascimento: sanitizeOptionalText(rawDataNascimento),
    email: sanitizeOptionalText(rawEmail),
    phone: sanitizeOptionalText(rawPhone),
    zipCode: sanitizeOptionalText(rawZipCode),
    address: sanitizeOptionalText(rawAddress),
    estadoCivil: sanitizeOptionalText(rawEstadoCivil),
    profissao: sanitizeOptionalText(rawProfissao),
    rg: sanitizeOptionalText(rawRg),
    cidadeUf: sanitizeOptionalText(rawCidadeUf),
    contribuicaoMensal: sanitizeOptionalText(rawContribuicaoMensal),
    valorDanoMoral: sanitizeOptionalText(rawValorDanoMoral),
    valorDaCausa: sanitizeOptionalText(rawValorDaCausa),
    possuiDeficiencia:
      rawPossuiDeficiencia !== undefined
        ? Boolean(rawPossuiDeficiencia)
        : undefined,
    tipoDeficiencia: sanitizeOptionalText(rawTipoDeficiencia),
    dataLaudo: sanitizeOptionalText(rawDataLaudo),
    cid: sanitizeOptionalText(rawCid),
    grauDeficienciaIfbra: sanitizeOptionalText(rawGrauDeficienciaIfbra),
    documentoComprobatorioNome: sanitizeOptionalText(
      rawDocumentoComprobatorioNome
    ),
    sexoPrevidenciario: sanitizeOptionalText(rawSexoPrevidenciario),
    calculoPrevidenciario:
      rawCalculoPrevidenciario && typeof rawCalculoPrevidenciario === 'object'
        ? (rawCalculoPrevidenciario as Record<string, unknown>)
        : undefined,
    observacoesJuridicas: sanitizeOptionalText(rawObservacoesJuridicas),
    enderecoEscritorio: sanitizeOptionalText(rawEnderecoEscritorio),
    enderecoDfIprev: sanitizeOptionalText(rawEnderecoDfIprev),
    periodos: sanitizePeriodos(rawPeriodos),
  };
};

const getAdvogadoIdFromSession = (req: Request): number | null => {
  // Corrige o tipo de req para incluir session (sem importar Session)
  const sessionUserId = (req as Request & { session?: { usuarioId?: number } })?.session?.usuarioId;
  if (sessionUserId && !Number.isNaN(Number(sessionUserId))) {
    return Number(sessionUserId);
  }

  const headerUserId = req.header('x-user-id');
  if (!headerUserId || Number.isNaN(Number(headerUserId))) {
    return null;
  }

  return Number(headerUserId);
};

const normalizeOptional = (value: string | undefined) => {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const normalizeSensitiveValue = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const normalized = sanitizeText(String(value));
  return normalized.length > 0 ? normalized : null;
};

const buildSensitiveSnapshot = (
  input: SensitiveSnapshotInput
): Record<string, string> => {
  const snapshot: Record<string, string> = {};

  const add = (key: string, value: unknown) => {
    const normalized = normalizeSensitiveValue(value);
    if (normalized !== null) snapshot[key] = normalized;
  };

  add('name', input.name);
  add('cpf', input.cpf);
  add('dataNascimento', input.dataNascimento);
  add('email', input.email);
  add('phone', input.phone);
  add('zipCode', input.zipCode);
  add('address', input.address);
  add('estadoCivil', input.estadoCivil);
  add('profissao', input.profissao);
  add('rg', input.rg);
  add('cidadeUf', input.cidadeUf);
  add('contribuicaoMensal', input.contribuicaoMensal);
  add('valorDanoMoral', input.valorDanoMoral);
  add('valorDaCausa', input.valorDaCausa);
  add('possuiDeficiencia', input.possuiDeficiencia);
  add('tipoDeficiencia', input.tipoDeficiencia);
  add('dataLaudo', input.dataLaudo);
  add('cid', input.cid);
  add('grauDeficienciaIfbra', input.grauDeficienciaIfbra);
  add('documentoComprobatorioNome', input.documentoComprobatorioNome);
  add('sexoPrevidenciario', input.sexoPrevidenciario);
  if (input.calculoPrevidenciario) {
    add('calculoPrevidenciario', JSON.stringify(input.calculoPrevidenciario));
  }
  add('observacoesJuridicas', input.observacoesJuridicas);
  add('enderecoEscritorio', input.enderecoEscritorio);
  add('enderecoDfIprev', input.enderecoDfIprev);

  if (Array.isArray(input.periodos) && input.periodos.length > 0) {
    snapshot.periodos = JSON.stringify(
      input.periodos.map(periodo => ({
        tipo: normalizeSensitiveValue(periodo.tipo),
        inicio: normalizeSensitiveValue(periodo.inicio),
        fim: normalizeSensitiveValue(periodo.fim),
      }))
    );
  }

  return snapshot;
};

const hashSensitiveSnapshot = async (snapshot: Record<string, string>) => {
  const entries = await Promise.all(
    Object.entries(snapshot).map(async ([key, value]) => [
      key,
      await bcrypt.hash(value, SALT_ROUNDS),
    ])
  );

  return Object.fromEntries(entries);
};

/**
 * Decifra os campos PII de uma linha retornada pelo SELECT.
 * Compatível com dados legados (sem prefixo 'enc:') — retorna como está.
 */
const decryptClientRow = (row: Record<string, any>): Record<string, any> => ({
  ...row,
  name: row.name ? decryptField(String(row.name)) : row.name,
  cpf: row.cpf ? decryptField(String(row.cpf)) : row.cpf,
  dataNascimento: row.dataNascimento
    ? decryptField(String(row.dataNascimento))
    : row.dataNascimento,
  email: row.email ? decryptField(String(row.email)) : row.email,
  phone: row.phone ? decryptField(String(row.phone)) : row.phone,
  zipCode: row.zipCode ? decryptField(String(row.zipCode)) : row.zipCode,
  address: row.address ? decryptField(String(row.address)) : row.address,
  rg: row.rg ? decryptField(String(row.rg)) : row.rg,
  cidadeUf: row.cidadeUf ? decryptField(String(row.cidadeUf)) : row.cidadeUf,
});

const clientSelectSql = `
  SELECT
    c.id,
    c.nome_completo AS name,
    c.cpf,
    c.data_nascimento AS "dataNascimento",
    c.email,
    c.telefone AS phone,
    c.cep AS "zipCode",
    c.endereco_completo AS address,
    c.estado_civil AS "estadoCivil",
    c.profissao,
    c.rg,
    c.cidade_uf AS "cidadeUf",
    c.contribuicao_mensal AS "contribuicaoMensal",
    c.valor_dano_moral AS "valorDanoMoral",
    c.valor_da_causa AS "valorDaCausa",
    c.possui_deficiencia AS "possuiDeficiencia",
    c.tipo_deficiencia AS "tipoDeficiencia",
    c.data_laudo AS "dataLaudo",
    c.cid,
    c.grau_deficiencia_ifbra AS "grauDeficienciaIfbra",
    c.documento_comprobatorio_nome AS "documentoComprobatorioNome",
    c.sexo_previdenciario AS "sexoPrevidenciario",
    c.calculo_previdenciario AS "calculoPrevidenciario",
    c.observacoes_juridicas AS "observacoesJuridicas",
    c.endereco_escritorio AS "enderecoEscritorio",
    c.endereco_df_iprev AS "enderecoDfIprev",
    c.advogado_id AS "advogadoId",
    a.nome_completo AS "nomeAdvogado",
    a.estado_oab AS "ufOab",
    a.numero_oab AS "numeroOab",
    c.created_at AS "createdAt",
    c.updated_at AS "updatedAt"
  FROM clientes_adv c
  INNER JOIN usuarios_adv a ON a.id = c.advogado_id
`;

const attachPeriodos = async (rows: any[]) => {
  if (!rows.length) return rows;
  const ids = rows.map(r => r.id);
  const periodosResult = await pool.query(
    `SELECT
       cliente_id AS "clienteId",
       tipo,
       data_inicio AS "inicio",
       data_fim AS "fim"
     FROM clientes_adv_periodos
     WHERE cliente_id = ANY($1::varchar[])
     ORDER BY id ASC`,
    [ids]
  );

  const grouped = new Map<string, any[]>();
  for (const periodo of periodosResult.rows) {
    const list = grouped.get(periodo.clienteId) || [];
    list.push({
      tipo: periodo.tipo,
      inicio: periodo.inicio,
      fim: periodo.fim,
    });
    grouped.set(periodo.clienteId, list);
  }

  return rows.map(row => {
    const {
      advogadoId,
      nomeAdvogado,
      ufOab,
      numeroOab,
      ...rest
    } = row;
    const decrypted = decryptClientRow(rest);
    return {
      ...decrypted,
      user: {
        id: advogadoId,
        nome: nomeAdvogado,
        ufOab,
        numeroOab,
      },
      periodos: grouped.get(row.id) || [],
    };
  });
};

// GET /api/clients
router.get('/', async (req: Request, res: Response) => {
  const advogadoId = getAdvogadoIdFromSession(req);
  if (!advogadoId) {
    return res
      .status(401)
      .json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  // LOG PARA DEPURAÇÃO DE SESSÃO E HEADER
  console.log('[CLIENTS SERVICE] session:', (req as any).session);
  console.log('[CLIENTS SERVICE] x-user-id header:', req.header('x-user-id'));

  try {
    const result = await pool.query(
      `${clientSelectSql}
       WHERE c.advogado_id = $1
       ORDER BY c.created_at DESC`,
      [advogadoId]
    );
    // Log para depuração do resultado da query
    console.log('Clientes retornados:', result.rows);
    return res.json(await attachPeriodos(result.rows));
  } catch (err) {
    console.error('Erro ao listar clientes:', err);
    return res.status(500).json({ error: 'Erro ao listar clientes.' });
  }
});

// GET /api/clients/:id
router.get('/:id', async (req: Request, res: Response) => {
  const advogadoId = getAdvogadoIdFromSession(req);
  if (!advogadoId) {
    return res
      .status(401)
      .json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  // LOG PARA DEPURAÇÃO DE SESSÃO E HEADER
  console.log('[CLIENTS SERVICE] session:', (req as any).session);
  console.log('[CLIENTS SERVICE] x-user-id header:', req.header('x-user-id'));

  try {
    const result = await pool.query(
      `${clientSelectSql}
       WHERE c.id = $1 AND c.advogado_id = $2`,
      [req.params.id, advogadoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const withPeriodos = await attachPeriodos(result.rows);
    return res.json(withPeriodos[0]);
  } catch (err) {
    console.error('Erro ao buscar cliente:', err);
    return res.status(500).json({ error: 'Erro ao buscar cliente.' });
  }
});

// POST /api/clients
router.post('/', async (req: Request, res: Response) => {
  const advogadoId = getAdvogadoIdFromSession(req);
  if (!advogadoId) {
    return res
      .status(401)
      .json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  const fields = mapClientFields(req.body || {});
  const name = fields.name?.trim() || '';
  const cpf = fields.cpf?.trim() || '';

  if (!name || !cpf) {
    return res
      .status(400)
      .json({ error: 'Nome completo e CPF são obrigatórios.' });
  }

  try {
    const clientId = uuid();
    const cpfHash = await bcrypt.hash(cpf, SALT_ROUNDS);
    const email = normalizeOptional(fields.email);
    const phone = normalizeOptional(fields.phone);
    const rg = normalizeOptional(fields.rg);

    const emailHash = email
      ? await bcrypt.hash(email.toLowerCase(), SALT_ROUNDS)
      : null;
    const phoneHash = phone ? await bcrypt.hash(phone, SALT_ROUNDS) : null;
    const rgHash = rg ? await bcrypt.hash(rg, SALT_ROUNDS) : null;

    const sensitiveSnapshot = buildSensitiveSnapshot({
      name,
      cpf,
      dataNascimento: normalizeOptional(fields.dataNascimento),
      email,
      phone,
      zipCode: normalizeOptional(fields.zipCode),
      address: normalizeOptional(fields.address),
      estadoCivil: normalizeOptional(fields.estadoCivil),
      profissao: normalizeOptional(fields.profissao),
      rg,
      cidadeUf: normalizeOptional(fields.cidadeUf),
      contribuicaoMensal: normalizeOptional(fields.contribuicaoMensal),
      valorDanoMoral: normalizeOptional(fields.valorDanoMoral),
      valorDaCausa: normalizeOptional(fields.valorDaCausa),
      possuiDeficiencia: fields.possuiDeficiencia ?? false,
      tipoDeficiencia: normalizeOptional(fields.tipoDeficiencia),
      dataLaudo: normalizeOptional(fields.dataLaudo),
      cid: normalizeOptional(fields.cid),
      grauDeficienciaIfbra: normalizeOptional(fields.grauDeficienciaIfbra),
      documentoComprobatorioNome: normalizeOptional(
        fields.documentoComprobatorioNome
      ),
      sexoPrevidenciario: normalizeOptional(fields.sexoPrevidenciario),
      calculoPrevidenciario: fields.calculoPrevidenciario ?? null,
      observacoesJuridicas: normalizeOptional(fields.observacoesJuridicas),
      enderecoEscritorio: normalizeOptional(fields.enderecoEscritorio),
      enderecoDfIprev: normalizeOptional(fields.enderecoDfIprev),
      periodos: fields.periodos,
    });
    const sensitiveHashes = await hashSensitiveSnapshot(sensitiveSnapshot);

    await pool.query('BEGIN');

    await pool.query(
      `INSERT INTO clientes_adv (
        id, advogado_id, nome_completo, cpf, cpf_hash, email, email_hash, telefone, telefone_hash,
        dados_sensiveis_hash,
        cep, endereco_completo, estado_civil, profissao, rg, rg_hash, cidade_uf, contribuicao_mensal,
        data_nascimento,
        valor_dano_moral, valor_da_causa, possui_deficiencia, tipo_deficiencia, data_laudo, cid,
        grau_deficiencia_ifbra, documento_comprobatorio_nome, sexo_previdenciario,
        calculo_previdenciario, observacoes_juridicas, endereco_escritorio, endereco_df_iprev
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10,
        $11, $12, $13, $14, $15, $16, $17, $18,
        $19,
        $20, $21, $22, $23, $24, $25,
        $26, $27, $28,
        $29::jsonb, $30, $31, $32
      )`,
      [
        clientId,
        advogadoId,
        encryptField(name),
        encryptField(cpf),
        cpfHash,
        encryptIfPresent(email) ?? null,
        emailHash,
        encryptIfPresent(phone) ?? null,
        phoneHash,
        JSON.stringify(sensitiveHashes),
        encryptIfPresent(normalizeOptional(fields.zipCode)) ?? null,
        encryptIfPresent(normalizeOptional(fields.address)) ?? null,
        normalizeOptional(fields.estadoCivil),
        normalizeOptional(fields.profissao),
        encryptIfPresent(rg) ?? null,
        rgHash,
        encryptIfPresent(normalizeOptional(fields.cidadeUf)) ?? null,
        normalizeOptional(fields.contribuicaoMensal),
        encryptIfPresent(normalizeOptional(fields.dataNascimento)) ?? null,
        normalizeOptional(fields.valorDanoMoral),
        normalizeOptional(fields.valorDaCausa),
        fields.possuiDeficiencia ?? false,
        normalizeOptional(fields.tipoDeficiencia),
        normalizeOptional(fields.dataLaudo),
        normalizeOptional(fields.cid),
        normalizeOptional(fields.grauDeficienciaIfbra),
        normalizeOptional(fields.documentoComprobatorioNome),
        normalizeOptional(fields.sexoPrevidenciario),
        fields.calculoPrevidenciario
          ? JSON.stringify(fields.calculoPrevidenciario)
          : null,
        normalizeOptional(fields.observacoesJuridicas),
        normalizeOptional(fields.enderecoEscritorio),
        normalizeOptional(fields.enderecoDfIprev),
      ]
    );

    for (const periodo of fields.periodos) {
      await pool.query(
        `INSERT INTO clientes_adv_periodos (cliente_id, tipo, data_inicio, data_fim)
         VALUES ($1, $2, $3, $4)`,
        [
          clientId,
          periodo.tipo,
          normalizeOptional(periodo.inicio),
          normalizeOptional(periodo.fim),
        ]
      );
    }

    await pool.query('COMMIT');

    const created = await pool.query(
      `${clientSelectSql}
       WHERE c.id = $1 AND c.advogado_id = $2`,
      [clientId, advogadoId]
    );

    const withPeriodos = await attachPeriodos(created.rows);
    return res.status(201).json(withPeriodos[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    if (err instanceof Error) {
      console.error('Erro ao criar cliente:', err, err.stack);
    } else {
      console.error('Erro ao criar cliente:', err);
    }
    return res.status(500).json({ error: 'Erro ao criar cliente.' });
  }
});

// PATCH /api/clients/:id
router.patch('/:id', async (req: Request, res: Response) => {
  const advogadoId = getAdvogadoIdFromSession(req);
  if (!advogadoId) {
    return res
      .status(401)
      .json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  const fields = mapClientFields(req.body || {});
  const updates: string[] = [];
  const values: Array<string | null> = [];
  const hasNonPeriodoUpdates = Object.entries(fields).some(
    ([key, value]) => key !== 'periodos' && value !== undefined
  );
  const hasFieldUpdates = hasNonPeriodoUpdates || fields.periodos.length > 0;

  if (!hasFieldUpdates) {
    return res
      .status(400)
      .json({ error: 'Nenhum campo válido para atualizar.' });
  }

  const addUpdate = (column: string, value: string | null | undefined) => {
    if (value === undefined) return;
    updates.push(`${column} = $${values.length + 1}`);
    values.push(value);
  };

  addUpdate(
    'nome_completo',
    fields.name !== undefined ? encryptField(fields.name.trim()) : undefined
  );
  addUpdate('cpf', fields.cpf !== undefined ? encryptField(fields.cpf.trim()) : undefined);
  addUpdate('data_nascimento', encryptIfPresent(normalizeOptional(fields.dataNascimento)));
  addUpdate('email', encryptIfPresent(normalizeOptional(fields.email)));
  addUpdate('telefone', encryptIfPresent(normalizeOptional(fields.phone)));
  addUpdate('cep', encryptIfPresent(normalizeOptional(fields.zipCode)));
  addUpdate('endereco_completo', encryptIfPresent(normalizeOptional(fields.address)));
  addUpdate('estado_civil', normalizeOptional(fields.estadoCivil));
  addUpdate('profissao', normalizeOptional(fields.profissao));
  addUpdate('rg', encryptIfPresent(normalizeOptional(fields.rg)));
  addUpdate('cidade_uf', encryptIfPresent(normalizeOptional(fields.cidadeUf)));
  addUpdate(
    'contribuicao_mensal',
    normalizeOptional(fields.contribuicaoMensal)
  );
  addUpdate('valor_dano_moral', normalizeOptional(fields.valorDanoMoral));
  addUpdate('valor_da_causa', normalizeOptional(fields.valorDaCausa));
  if (fields.possuiDeficiencia !== undefined) {
    updates.push(`possui_deficiencia = $${values.length + 1}`);
    values.push(fields.possuiDeficiencia ? 'true' : 'false');
  }
  addUpdate('tipo_deficiencia', normalizeOptional(fields.tipoDeficiencia));
  addUpdate('data_laudo', normalizeOptional(fields.dataLaudo));
  addUpdate('cid', normalizeOptional(fields.cid));
  addUpdate(
    'grau_deficiencia_ifbra',
    normalizeOptional(fields.grauDeficienciaIfbra)
  );
  addUpdate(
    'documento_comprobatorio_nome',
    normalizeOptional(fields.documentoComprobatorioNome)
  );
  addUpdate('sexo_previdenciario', normalizeOptional(fields.sexoPrevidenciario));
  if (fields.calculoPrevidenciario !== undefined) {
    updates.push(`calculo_previdenciario = $${values.length + 1}::jsonb`);
    values.push(
      fields.calculoPrevidenciario
        ? JSON.stringify(fields.calculoPrevidenciario)
        : null
    );
  }
  addUpdate(
    'observacoes_juridicas',
    normalizeOptional(fields.observacoesJuridicas)
  );
  addUpdate(
    'endereco_escritorio',
    normalizeOptional(fields.enderecoEscritorio)
  );
  addUpdate('endereco_df_iprev', normalizeOptional(fields.enderecoDfIprev));

  try {
    const existingResult = await pool.query(
      `${clientSelectSql}
       WHERE c.id = $1 AND c.advogado_id = $2`,
      [req.params.id, advogadoId]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const existing = decryptClientRow(existingResult.rows[0]);
    const existingPeriodosResult = await pool.query(
      `SELECT tipo, data_inicio AS inicio, data_fim AS fim
       FROM clientes_adv_periodos
       WHERE cliente_id = $1
       ORDER BY id ASC`,
      [req.params.id]
    );

    const periodosForHash =
      fields.periodos.length > 0
        ? fields.periodos
        : existingPeriodosResult.rows.map((periodo: any) => ({
            tipo: sanitizeOptionalText(periodo.tipo),
            inicio: sanitizeOptionalText(periodo.inicio),
            fim: sanitizeOptionalText(periodo.fim),
          }));

    const mergedSensitiveSnapshot = buildSensitiveSnapshot({
      name: fields.name !== undefined ? fields.name.trim() : existing.name,
      cpf: fields.cpf !== undefined ? fields.cpf.trim() : existing.cpf,
      dataNascimento:
        fields.dataNascimento !== undefined
          ? normalizeOptional(fields.dataNascimento)
          : sanitizeOptionalText(existing.dataNascimento),
      email:
        fields.email !== undefined
          ? normalizeOptional(fields.email)
          : existing.email,
      phone:
        fields.phone !== undefined
          ? normalizeOptional(fields.phone)
          : existing.phone,
      zipCode:
        fields.zipCode !== undefined
          ? normalizeOptional(fields.zipCode)
          : existing.zipCode,
      address:
        fields.address !== undefined
          ? normalizeOptional(fields.address)
          : existing.address,
      estadoCivil:
        fields.estadoCivil !== undefined
          ? normalizeOptional(fields.estadoCivil)
          : existing.estadoCivil,
      profissao:
        fields.profissao !== undefined
          ? normalizeOptional(fields.profissao)
          : existing.profissao,
      rg: fields.rg !== undefined ? normalizeOptional(fields.rg) : existing.rg,
      cidadeUf:
        fields.cidadeUf !== undefined
          ? normalizeOptional(fields.cidadeUf)
          : existing.cidadeUf,
      contribuicaoMensal:
        fields.contribuicaoMensal !== undefined
          ? normalizeOptional(fields.contribuicaoMensal)
          : existing.contribuicaoMensal,
      valorDanoMoral:
        fields.valorDanoMoral !== undefined
          ? normalizeOptional(fields.valorDanoMoral)
          : existing.valorDanoMoral,
      valorDaCausa:
        fields.valorDaCausa !== undefined
          ? normalizeOptional(fields.valorDaCausa)
          : existing.valorDaCausa,
      possuiDeficiencia:
        fields.possuiDeficiencia !== undefined
          ? fields.possuiDeficiencia
          : existing.possuiDeficiencia,
      tipoDeficiencia:
        fields.tipoDeficiencia !== undefined
          ? normalizeOptional(fields.tipoDeficiencia)
          : existing.tipoDeficiencia,
      dataLaudo:
        fields.dataLaudo !== undefined
          ? normalizeOptional(fields.dataLaudo)
          : sanitizeOptionalText(existing.dataLaudo),
      cid:
        fields.cid !== undefined ? normalizeOptional(fields.cid) : existing.cid,
      grauDeficienciaIfbra:
        fields.grauDeficienciaIfbra !== undefined
          ? normalizeOptional(fields.grauDeficienciaIfbra)
          : existing.grauDeficienciaIfbra,
      documentoComprobatorioNome:
        fields.documentoComprobatorioNome !== undefined
          ? normalizeOptional(fields.documentoComprobatorioNome)
          : existing.documentoComprobatorioNome,
      sexoPrevidenciario:
        fields.sexoPrevidenciario !== undefined
          ? normalizeOptional(fields.sexoPrevidenciario)
          : existing.sexoPrevidenciario,
      calculoPrevidenciario:
        fields.calculoPrevidenciario !== undefined
          ? fields.calculoPrevidenciario
          : existing.calculoPrevidenciario,
      observacoesJuridicas:
        fields.observacoesJuridicas !== undefined
          ? normalizeOptional(fields.observacoesJuridicas)
          : existing.observacoesJuridicas,
      enderecoEscritorio:
        fields.enderecoEscritorio !== undefined
          ? normalizeOptional(fields.enderecoEscritorio)
          : existing.enderecoEscritorio,
      enderecoDfIprev:
        fields.enderecoDfIprev !== undefined
          ? normalizeOptional(fields.enderecoDfIprev)
          : existing.enderecoDfIprev,
      periodos: periodosForHash,
    });
    const sensitiveHashes = await hashSensitiveSnapshot(
      mergedSensitiveSnapshot
    );
    addUpdate('dados_sensiveis_hash', JSON.stringify(sensitiveHashes));

    if (fields.cpf !== undefined) {
      const cpfValue = fields.cpf.trim();
      if (!cpfValue) {
        return res.status(400).json({ error: 'CPF não pode ser vazio.' });
      }
      addUpdate('cpf_hash', await bcrypt.hash(cpfValue, SALT_ROUNDS));
    }

    if (fields.email !== undefined) {
      const emailValue = normalizeOptional(fields.email);
      addUpdate(
        'email_hash',
        emailValue
          ? await bcrypt.hash(emailValue.toLowerCase(), SALT_ROUNDS)
          : null
      );
    }

    if (fields.phone !== undefined) {
      const phoneValue = normalizeOptional(fields.phone);
      addUpdate(
        'telefone_hash',
        phoneValue ? await bcrypt.hash(phoneValue, SALT_ROUNDS) : null
      );
    }

    if (fields.rg !== undefined) {
      const rgValue = normalizeOptional(fields.rg);
      addUpdate(
        'rg_hash',
        rgValue ? await bcrypt.hash(rgValue, SALT_ROUNDS) : null
      );
    }

    await pool.query('BEGIN');

    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);

      values.push(req.params.id);
      values.push(String(advogadoId));

      const result = await pool.query(
        `UPDATE clientes_adv
         SET ${updates.join(', ')}
         WHERE id = $${values.length - 1} AND advogado_id = $${values.length}`,
        values
      );

      if (!result.rowCount) {
        await pool.query('ROLLBACK');
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
    }

    if (fields.periodos.length > 0) {
      await pool.query(
        'DELETE FROM clientes_adv_periodos WHERE cliente_id = $1',
        [req.params.id]
      );

      for (const periodo of fields.periodos) {
        await pool.query(
          `INSERT INTO clientes_adv_periodos (cliente_id, tipo, data_inicio, data_fim)
           VALUES ($1, $2, $3, $4)`,
          [
            req.params.id,
            periodo.tipo,
            normalizeOptional(periodo.inicio),
            normalizeOptional(periodo.fim),
          ]
        );
      }
    }

    await pool.query('COMMIT');

    const updated = await pool.query(
      `${clientSelectSql}
       WHERE c.id = $1 AND c.advogado_id = $2`,
      [req.params.id, advogadoId]
    );

    const withPeriodos = await attachPeriodos(updated.rows);
    return res.json(withPeriodos[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Erro ao atualizar cliente:', err);
    return res.status(500).json({ error: 'Erro ao atualizar cliente.' });
  }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const advogadoId = getAdvogadoIdFromSession(req);
  if (!advogadoId) {
    return res
      .status(401)
      .json({ error: 'Sessão expirada. Faça login novamente.' });
  }

  try {
    const result = await pool.query(
      'DELETE FROM clientes_adv WHERE id = $1 AND advogado_id = $2 RETURNING id',
      [req.params.id, advogadoId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    return res.json({ success: true, deletedId: result.rows[0].id });
  } catch (err) {
    console.error('Erro ao excluir cliente:', err);
    return res.status(500).json({ error: 'Erro ao excluir cliente.' });
  }
});

export default router;
