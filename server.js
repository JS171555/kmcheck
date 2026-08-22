require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const app = express();
const PORT = Number(process.env.PORT || 6969);
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const DATA_FILE = path.join(__dirname, 'data', 'vehicles.json');

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function normalizePlate(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function validatePlate(plate) {
  return /^[A-Z0-9]{7}$/.test(plate);
}

function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') || req.query.key || '';

  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({
      error: 'Chave administrativa inválida.'
    });
  }

  next();
}

app.get('/admin', requireAdmin, (req, res) => {
  res.send('OK');
});

async function readDatabase() {
  try {
    const content = await fs.readFile(DATA_FILE, 'utf8');
    const db = JSON.parse(content);
    if (!db || !Array.isArray(db.vehicles)) return { vehicles: [] };
    return db;
  } catch (error) {
    if (error.code === 'ENOENT') {
      const empty = { vehicles: [] };
      await writeDatabase(empty);
      return empty;
    }
    throw error;
  }
}

async function writeDatabase(db) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  const tempFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tempFile, DATA_FILE);
}

function toApiInspection(vehicle, entry, index) {
  return {
    id: `${vehicle.placa}-${index + 1}`,
    dataVistoria: entry.data,
    modalidade: entry.modalidade || 'Vistoria',
    situacao: { descricao: entry.situacao || 'Não informado' },
    veiculo: {
      placa: vehicle.placa,
      km: Number(entry.km),
      marca: { descricao: vehicle.marca || '' },
      modelo: { descricao: vehicle.modelo || '' },
      nome: vehicle.nome || '',
      tipo: { descricao: vehicle.tipo || 'Automóvel' },
      anoModelo: vehicle.anoModelo || null
    }
  };
}

function validateVehiclePayload(body) {
  const plate = normalizePlate(body.placa);
  const errors = [];

  if (!validatePlate(plate)) errors.push('Placa deve conter 7 caracteres.');
  if (!String(body.nome || body.modelo || '').trim()) errors.push('Informe o nome/modelo do veículo.');

  const history = Array.isArray(body.historico) ? body.historico : [];
  if (!history.length) errors.push('Cadastre pelo menos um registro de quilometragem.');

  const normalizedHistory = history.map((item, index) => {
    const km = Number(item.km);
    const data = String(item.data || '').trim();
    if (!data) errors.push(`Registro ${index + 1}: informe a data.`);
    if (!Number.isFinite(km) || km < 0) errors.push(`Registro ${index + 1}: quilometragem inválida.`);
    return {
      data,
      km: Math.round(km),
      modalidade: String(item.modalidade || 'Vistoria').trim(),
      situacao: String(item.situacao || 'Aprovado').trim()
    };
  });

  normalizedHistory.sort((a, b) => new Date(a.data) - new Date(b.data));

  return {
    errors,
    vehicle: {
      placa: plate,
      nome: String(body.nome || body.modelo || '').trim(),
      marca: String(body.marca || '').trim(),
      modelo: String(body.modelo || '').trim(),
      tipo: String(body.tipo || 'Automóvel').trim(),
      anoModelo: body.anoModelo ? Number(body.anoModelo) : null,
      historico: normalizedHistory
    }
  };
}

app.get('/api/health', async (_req, res) => {
  try {
    const db = await readDatabase();
    res.json({
      ok: true,
      service: 'KMCheck',
      api: 'database-local',
      vehicles: db.vehicles.length
    });
  } catch {
    res.status(500).json({ ok: false, error: 'Não foi possível ler a base do KMCheck.' });
  }
});

// API pública de consulta: o frontend continua chamando o mesmo endpoint.
app.get('/api/vistorias', async (req, res) => {
  const plate = normalizePlate(req.query.placa);

  if (!validatePlate(plate)) {
    return res.status(400).json({ error: 'Informe uma placa válida com 7 caracteres.' });
  }

  try {
    const db = await readDatabase();
    const vehicle = db.vehicles.find((item) => normalizePlate(item.placa) === plate);

    if (!vehicle) {
      return res.status(404).json({
        error: 'Veículo não cadastrado na base do KMCheck.',
        code: 'VEHICLE_NOT_FOUND'
      });
    }

    const data = [...vehicle.historico]
      .sort((a, b) => new Date(a.data) - new Date(b.data))
      .map((entry, index) => toApiInspection(vehicle, entry, index));

    return res.json({
      ok: true,
      fonte: 'KMCheck — base própria',
      data
    });
  } catch (error) {
    console.error('Erro ao consultar a base:', error);
    return res.status(500).json({
      error: 'Não foi possível consultar a base do KMCheck.',
      code: 'DATABASE_ERROR'
    });
  }
});

// Lista resumida para o painel administrativo.
app.get('/api/admin/veiculos', requireAdmin, async (_req, res) => {
  try {
    const db = await readDatabase();
    const vehicles = db.vehicles.map((vehicle) => ({
      placa: vehicle.placa,
      nome: vehicle.nome,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      anoModelo: vehicle.anoModelo,
      totalRegistros: vehicle.historico.length,
      ultimoKm: vehicle.historico.length ? vehicle.historico[vehicle.historico.length - 1].km : null
    }));
    res.json({ data: vehicles });
  } catch {
    res.status(500).json({ error: 'Erro ao listar veículos.' });
  }
});

app.get('/api/admin/veiculos/:placa', requireAdmin, async (req, res) => {
  try {
    const plate = normalizePlate(req.params.placa);
    const db = await readDatabase();
    const vehicle = db.vehicles.find((item) => normalizePlate(item.placa) === plate);
    if (!vehicle) return res.status(404).json({ error: 'Veículo não encontrado.' });
    res.json(vehicle);
  } catch {
    res.status(500).json({ error: 'Erro ao carregar veículo.' });
  }
});

app.post('/api/admin/veiculos', requireAdmin, async (req, res) => {
  try {
    const { errors, vehicle } = validateVehiclePayload(req.body);
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const db = await readDatabase();
    const exists = db.vehicles.some((item) => normalizePlate(item.placa) === vehicle.placa);
    if (exists) return res.status(409).json({ error: 'Essa placa já está cadastrada. Use PUT para atualizar.' });

    db.vehicles.push(vehicle);
    await writeDatabase(db);
    res.status(201).json({ ok: true, data: vehicle });
  } catch (error) {
    console.error('Erro ao cadastrar veículo:', error);
    res.status(500).json({ error: 'Erro ao salvar veículo.' });
  }
});

app.put('/api/admin/veiculos/:placa', requireAdmin, async (req, res) => {
  try {
    const currentPlate = normalizePlate(req.params.placa);
    const { errors, vehicle } = validateVehiclePayload({ ...req.body, placa: currentPlate });
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    const db = await readDatabase();
    const index = db.vehicles.findIndex((item) => normalizePlate(item.placa) === currentPlate);
    if (index === -1) return res.status(404).json({ error: 'Veículo não encontrado.' });

    db.vehicles[index] = vehicle;
    await writeDatabase(db);
    res.json({ ok: true, data: vehicle });
  } catch (error) {
    console.error('Erro ao atualizar veículo:', error);
    res.status(500).json({ error: 'Erro ao atualizar veículo.' });
  }
});

app.delete('/api/admin/veiculos/:placa', requireAdmin, async (req, res) => {
  try {
    const plate = normalizePlate(req.params.placa);
    const db = await readDatabase();
    const originalLength = db.vehicles.length;
    db.vehicles = db.vehicles.filter((item) => normalizePlate(item.placa) !== plate);

    if (db.vehicles.length === originalLength) {
      return res.status(404).json({ error: 'Veículo não encontrado.' });
    }

    await writeDatabase(db);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Erro ao excluir veículo.' });
  }
});

app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KMCheck rodando em http://localhost:${PORT}`);
  console.log(`Base própria: ${DATA_FILE}`);
});