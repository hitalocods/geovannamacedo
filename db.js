const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'local_db.json');

// Garante que a pasta local exista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let isNeonConnected = false;
let pool = null;

// Dados Padrão Iniciais
const DEFAULT_SERVICES = [
  { id: 'social', name: 'Maquiagem Social', duration: '1h', price: 160.00, description: 'Produção sofisticada e duradoura para eventos sociais, madrinhas e convidadas.' },
  { id: 'noiva', name: 'Noiva (Produção Completa)', duration: '2h30', price: 450.00, description: 'Atendimento de alta exclusividade com prévia, blindagem total e acabamento de alta definição.' },
  { id: 'formanda', name: 'Formanda Glam', duration: '2h', price: 220.00, description: 'Make marcante com iluminação glamorosa, pele resistente a lágrimas e fotos inesquecíveis.' },
  { id: 'penteado', name: 'Penteado Exclusivo', duration: '1h', price: 140.00, description: 'Semipreso, coque clássico, tranças estilizadas ou ondas glamorosas.' },
  { id: 'combo', name: 'Combo Make + Penteado', duration: '2h', price: 280.00, description: 'Harmonização total de cabelo e maquiagem para uma presença impecável.' }
];

const DEFAULT_INVENTORY = [
  { id: 1, name: 'Base Líquida Kryolan Dermacolor', category: 'Maquiagem', quantity: 4, min_quantity: 2, cost_price: 189.90, supplier: 'Kryolan Brasil', last_restock: '2026-08-28' },
  { id: 2, name: 'Cílios Postiços 3D Mink (Par)', category: 'Descartáveis', quantity: 15, min_quantity: 5, cost_price: 14.50, supplier: 'Distribuidora Glam', last_restock: '2026-08-25' },
  { id: 3, name: 'Fixador de Maquiagem Blindagem', category: 'Maquiagem', quantity: 1, min_quantity: 3, cost_price: 65.00, supplier: 'Beauty Store', last_restock: '2026-08-10' },
  { id: 4, name: 'Spray Fixador de Penteado Extra Forte', category: 'Penteados', quantity: 5, min_quantity: 2, cost_price: 58.00, supplier: 'Schwarzkopf', last_restock: '2026-08-20' },
  { id: 5, name: 'Pó Facial Translúcido Laura Mercier', category: 'Maquiagem', quantity: 1, min_quantity: 2, cost_price: 240.00, supplier: 'Sephora', last_restock: '2026-08-15' },
  { id: 6, name: 'Iluminador Líquido Rare Beauty', category: 'Maquiagem', quantity: 3, min_quantity: 2, cost_price: 190.00, supplier: 'Sephora', last_restock: '2026-08-29' }
];

const DEFAULT_AVAILABILITY = {
  active_days: [1, 2, 3, 4, 5, 6], // Seg a Sáb por padrão
  custom_times: ['07:30', '08:30', '10:00', '11:30', '14:00', '15:30', '17:00', '18:30'],
  blocked_dates: [
    { id: '1', date: '2026-09-15', reason: 'Curso de Especialização' },
    { id: '2', date: '2026-09-25', reason: 'Viagem / Congresso' }
  ]
};

// Funções de banco local (JSON fallback)
function getLocalData() {
  if (!fs.existsSync(LOCAL_DB_FILE)) {
    const initialData = {
      appointments: [
        {
          id: 1,
          client_name: 'Camila Vasconcelos',
          client_phone: '(86) 99841-2233',
          service_id: 'combo',
          service_name: 'Combo Make + Penteado',
          price: 310.00,
          appointment_date: '2026-08-29',
          appointment_time: '14:00',
          status: 'confirmado',
          payment_status: 'pago_total',
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          client_name: 'Larissa Menezes',
          client_phone: '(86) 98112-9900',
          service_id: 'formanda',
          service_name: 'Produção Formanda Glam',
          price: 350.00,
          appointment_date: '2026-08-29',
          appointment_time: '16:30',
          status: 'pendente',
          payment_status: 'sinal_pago',
          created_at: new Date().toISOString()
        },
        {
          id: 3,
          client_name: 'Beatriz Alencar',
          client_phone: '(86) 99455-1122',
          service_id: 'noiva',
          service_name: 'Produção Noiva Premium',
          price: 750.00,
          appointment_date: '2026-09-05',
          appointment_time: '15:00',
          status: 'confirmado',
          payment_status: 'sinal_pago',
          created_at: new Date().toISOString()
        }
      ],
      finances: [
        { id: 1, type: 'receita', category: 'Combo Make + Penteado', description: 'Atendimento Camila Vasconcelos', amount: 310.00, date: '2026-08-29', payment_method: 'pix', status: 'pago', created_at: new Date().toISOString() },
        { id: 2, type: 'receita', category: 'Produção Formanda Glam', description: 'Sinal Formatura Larissa Menezes', amount: 150.00, date: '2026-08-29', payment_method: 'pix', status: 'pago', created_at: new Date().toISOString() },
        { id: 3, type: 'despesa', category: 'Produtos & Cosméticos', description: 'Reposição de bases Kryolan e Cílios postiços', amount: 120.00, date: '2026-08-29', payment_method: 'cartao_credito', status: 'pago', created_at: new Date().toISOString() },
        { id: 4, type: 'receita', category: 'Produção Noiva Premium', description: 'Agendamento: Beatriz Alencar', amount: 375.00, date: '2026-09-05', payment_method: 'pix', status: 'pago', created_at: new Date().toISOString() }
      ],
      inventory: DEFAULT_INVENTORY,
      availability: DEFAULT_AVAILABILITY,
      services: DEFAULT_SERVICES
    };
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
    return initialData;
  }
  try {
    return JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf-8'));
  } catch (err) {
    return { appointments: [], finances: [], inventory: DEFAULT_INVENTORY, availability: DEFAULT_AVAILABILITY, services: DEFAULT_SERVICES };
  }
}

function saveLocalData(data) {
  fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Inicializador do Banco
async function initDb() {
  const dbUrl = process.env.DATABASE_URL;

  if (dbUrl && dbUrl.trim().startsWith('postgres')) {
    try {
      console.log('🔄 Conectando ao Neon PostgreSQL...');
      pool = new Pool({
        connectionString: dbUrl.trim(),
        ssl: { rejectUnauthorized: false }
      });

      // Cria tabelas no Neon se não existirem
      await pool.query(`
        CREATE TABLE IF NOT EXISTS appointments (
          id SERIAL PRIMARY KEY,
          client_name VARCHAR(255) NOT NULL,
          client_phone VARCHAR(50) NOT NULL,
          service_id VARCHAR(50),
          service_name VARCHAR(255) NOT NULL,
          price NUMERIC(10, 2) DEFAULT 0.00,
          appointment_date VARCHAR(50) NOT NULL,
          appointment_time VARCHAR(20) NOT NULL,
          notes TEXT,
          payment_status VARCHAR(50) DEFAULT 'pendente',
          payment_method VARCHAR(50) DEFAULT 'pix',
          status VARCHAR(50) DEFAULT 'pendente',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS finances (
          id SERIAL PRIMARY KEY,
          type VARCHAR(20) NOT NULL,
          category VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          amount NUMERIC(10, 2) NOT NULL,
          date VARCHAR(50) NOT NULL,
          payment_method VARCHAR(50) DEFAULT 'pix',
          status VARCHAR(50) DEFAULT 'pago',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventory (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(100) NOT NULL,
          quantity INT DEFAULT 0,
          min_quantity INT DEFAULT 2,
          cost_price NUMERIC(10, 2) DEFAULT 0.00,
          supplier VARCHAR(255),
          last_restock VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
          key VARCHAR(100) PRIMARY KEY,
          value JSONB NOT NULL
        );
      `);

      // Seed inicial no Neon se estiver vazio
      const appCountRes = await pool.query('SELECT COUNT(*) FROM appointments');
      if (parseInt(appCountRes.rows[0].count, 10) === 0) {
        const local = getLocalData();
        for (const a of (local.appointments || [])) {
          await pool.query(
            `INSERT INTO appointments (client_name, client_phone, service_id, service_name, price, appointment_date, appointment_time, status, payment_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [a.client_name, a.client_phone, a.service_id, a.service_name, a.price, a.appointment_date, a.appointment_time, a.status, a.payment_status]
          );
        }
        for (const f of (local.finances || [])) {
          await pool.query(
            `INSERT INTO finances (type, category, description, amount, date, payment_method, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [f.type, f.category, f.description, f.amount, f.date, f.payment_method, f.status]
          );
        }
        for (const i of (local.inventory || [])) {
          await pool.query(
            `INSERT INTO inventory (name, category, quantity, min_quantity, cost_price, supplier, last_restock)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [i.name, i.category, i.quantity, i.min_quantity, i.cost_price, i.supplier, i.last_restock]
          );
        }
        await pool.query(
          `INSERT INTO settings (key, value) VALUES ('availability', $1) ON CONFLICT (key) DO UPDATE SET value = $1`,
          [JSON.stringify(local.availability || DEFAULT_AVAILABILITY)]
        );
      }

      isNeonConnected = true;
      console.log('✅ Neon PostgreSQL Conectado com Sucesso!');
    } catch (err) {
      console.warn('⚠️ Falha ao conectar no Neon. Usando armazenamento local JSON.', err.message);
      isNeonConnected = false;
      getLocalData();
    }
  } else {
    console.log('📁 Usando banco de dados local JSON (data/local_db.json).');
    getLocalData();
  }
}

function getDbStatus() {
  return {
    isNeonConnected,
    storage: isNeonConnected ? 'Neon PostgreSQL Cloud' : 'Local JSON Storage',
    timestamp: new Date().toISOString()
  };
}

// ----------------------------------------------------
// MÉTODOS DE AGENDAMENTOS
// ----------------------------------------------------
async function getAppointments(filters = {}) {
  if (isNeonConnected) {
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    if (filters.status && filters.status !== 'todos') {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }
    if (filters.date) {
      params.push(filters.date);
      sql += ` AND appointment_date = $${params.length}`;
    }
    if (filters.startDate && filters.endDate) {
      params.push(filters.startDate, filters.endDate);
      sql += ` AND appointment_date >= $${params.length - 1} AND appointment_date <= $${params.length}`;
    }
    sql += ' ORDER BY appointment_date DESC, appointment_time ASC';
    const res = await pool.query(sql, params);
    return res.rows;
  } else {
    const data = getLocalData();
    let list = data.appointments || [];
    if (filters.status && filters.status !== 'todos') {
      list = list.filter(a => a.status === filters.status);
    }
    if (filters.date) {
      list = list.filter(a => a.appointment_date === filters.date);
    }
    if (filters.startDate && filters.endDate) {
      list = list.filter(a => a.appointment_date >= filters.startDate && a.appointment_date <= filters.endDate);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(a => a.client_name.toLowerCase().includes(q) || a.client_phone.includes(q) || a.service_name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => (b.appointment_date + b.appointment_time).localeCompare(a.appointment_date + a.appointment_time));
  }
}

async function getAppointmentById(id) {
  if (isNeonConnected) {
    const res = await pool.query('SELECT * FROM appointments WHERE id = $1', [id]);
    return res.rows[0] || null;
  } else {
    const data = getLocalData();
    return data.appointments.find(a => String(a.id) === String(id)) || null;
  }
}

async function createAppointment(appData) {
  if (isNeonConnected) {
    const res = await pool.query(
      `INSERT INTO appointments (client_name, client_phone, service_id, service_name, price, appointment_date, appointment_time, notes, payment_status, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [appData.client_name, appData.client_phone, appData.service_id, appData.service_name, appData.price, appData.appointment_date, appData.appointment_time, appData.notes || '', appData.payment_status || 'pendente', appData.payment_method || 'pix', appData.status || 'pendente']
    );
    return res.rows[0];
  } else {
    const data = getLocalData();
    const newId = data.appointments.length > 0 ? Math.max(...data.appointments.map(a => a.id)) + 1 : 1;
    const newApp = {
      id: newId,
      ...appData,
      created_at: new Date().toISOString()
    };
    data.appointments.unshift(newApp);
    saveLocalData(data);
    return newApp;
  }
}

async function updateAppointment(id, updates) {
  if (isNeonConnected) {
    const existing = await getAppointmentById(id);
    if (!existing) return null;
    const fields = [];
    const values = [];
    Object.keys(updates).forEach((key, idx) => {
      fields.push(`${key} = $${idx + 1}`);
      values.push(updates[key]);
    });
    values.push(id);
    const sql = `UPDATE appointments SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows[0];
  } else {
    const data = getLocalData();
    const idx = data.appointments.findIndex(a => String(a.id) === String(id));
    if (idx === -1) return null;
    data.appointments[idx] = { ...data.appointments[idx], ...updates };
    saveLocalData(data);
    return data.appointments[idx];
  }
}

async function deleteAppointment(id) {
  if (isNeonConnected) {
    const res = await pool.query('DELETE FROM appointments WHERE id = $1 RETURNING *', [id]);
    return res.rows[0] || null;
  } else {
    const data = getLocalData();
    const idx = data.appointments.findIndex(a => String(a.id) === String(id));
    if (idx === -1) return null;
    const removed = data.appointments.splice(idx, 1)[0];
    saveLocalData(data);
    return removed;
  }
}

// ----------------------------------------------------
// MÉTODOS FINANCEIROS
// ----------------------------------------------------
async function getTransactions(filters = {}) {
  if (isNeonConnected) {
    let sql = 'SELECT * FROM finances WHERE 1=1';
    const params = [];
    if (filters.type && filters.type !== 'todos') {
      params.push(filters.type);
      sql += ` AND type = $${params.length}`;
    }
    if (filters.category) {
      params.push(filters.category);
      sql += ` AND category = $${params.length}`;
    }
    if (filters.startDate && filters.endDate) {
      params.push(filters.startDate, filters.endDate);
      sql += ` AND date >= $${params.length - 1} AND date <= $${params.length}`;
    }
    sql += ' ORDER BY date DESC, id DESC';
    const res = await pool.query(sql, params);
    return res.rows;
  } else {
    const data = getLocalData();
    let list = data.finances || [];
    if (filters.type && filters.type !== 'todos') {
      list = list.filter(f => f.type === filters.type);
    }
    if (filters.category) {
      list = list.filter(f => f.category === filters.category);
    }
    if (filters.startDate && filters.endDate) {
      list = list.filter(f => f.date >= filters.startDate && f.date <= filters.endDate);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }
}

async function createTransaction(txData) {
  if (isNeonConnected) {
    const res = await pool.query(
      `INSERT INTO finances (type, category, description, amount, date, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [txData.type, txData.category, txData.description, txData.amount, txData.date, txData.payment_method || 'pix', txData.status || 'pago']
    );
    return res.rows[0];
  } else {
    const data = getLocalData();
    const newId = data.finances.length > 0 ? Math.max(...data.finances.map(f => f.id)) + 1 : 1;
    const newTx = { id: newId, ...txData, created_at: new Date().toISOString() };
    data.finances.unshift(newTx);
    saveLocalData(data);
    return newTx;
  }
}

async function updateTransaction(id, updates) {
  if (isNeonConnected) {
    const fields = [];
    const values = [];
    Object.keys(updates).forEach((key, idx) => {
      fields.push(`${key} = $${idx + 1}`);
      values.push(updates[key]);
    });
    values.push(id);
    const sql = `UPDATE finances SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows[0];
  } else {
    const data = getLocalData();
    const idx = data.finances.findIndex(f => String(f.id) === String(id));
    if (idx === -1) return null;
    data.finances[idx] = { ...data.finances[idx], ...updates };
    saveLocalData(data);
    return data.finances[idx];
  }
}

async function deleteTransaction(id) {
  if (isNeonConnected) {
    const res = await pool.query('DELETE FROM finances WHERE id = $1 RETURNING *', [id]);
    return res.rows[0] || null;
  } else {
    const data = getLocalData();
    const idx = data.finances.findIndex(f => String(f.id) === String(id));
    if (idx === -1) return null;
    const removed = data.finances.splice(idx, 1)[0];
    saveLocalData(data);
    return removed;
  }
}

async function getFinancialMetrics(period = 'mes', customStart = null, customEnd = null) {
  const transactions = await getTransactions();
  const appointments = await getAppointments();

  const now = new Date();
  let startDate = '';
  let endDate = now.toISOString().split('T')[0];

  if (customStart && customEnd) {
    startDate = customStart;
    endDate = customEnd;
  } else if (period === 'dia') {
    startDate = endDate;
  } else if (period === 'semana') {
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startDate = startOfWeek.toISOString().split('T')[0];
  } else if (period === 'mes') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  } else if (period === 'ano') {
    startDate = `${now.getFullYear()}-01-01`;
  }

  const filteredTx = startDate
    ? transactions.filter(t => t.date >= startDate && t.date <= endDate)
    : transactions;

  const filteredApps = startDate
    ? appointments.filter(a => a.appointment_date >= startDate && a.appointment_date <= endDate)
    : appointments;

  let totalRevenue = 0;
  let totalExpenses = 0;

  filteredTx.forEach(t => {
    const val = parseFloat(t.amount) || 0;
    if (t.type === 'receita') totalRevenue += val;
    else if (t.type === 'despesa') totalExpenses += val;
  });

  const netProfit = totalRevenue - totalExpenses;
  const completedApps = filteredApps.filter(a => a.status === 'concluido').length;
  const pendingApps = filteredApps.filter(a => a.status === 'pendente').length;
  const averageTicket = filteredApps.length > 0 ? (totalRevenue / filteredApps.length) : 0;

  // Timeline chart labels & data
  const timeline = {
    labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
    revenue: [100, 130, 140, 90],
    expenses: [40, 30, 25, 25]
  };

  // Categories chart
  const catMap = {};
  filteredTx.forEach(t => {
    const cat = t.category || 'Geral';
    catMap[cat] = (catMap[cat] || 0) + (parseFloat(t.amount) || 0);
  });

  const categories = {
    labels: Object.keys(catMap).length > 0 ? Object.keys(catMap) : ['Atendimentos'],
    values: Object.keys(catMap).length > 0 ? Object.values(catMap) : [totalRevenue]
  };

  return {
    metrics: {
      totalRevenue,
      totalExpenses,
      netProfit,
      totalAppointments: filteredApps.length,
      completedAppointments: completedApps,
      pendingAppointments: pendingApps,
      averageTicket
    },
    charts: { timeline, categories }
  };
}

// ----------------------------------------------------
// MÉTODOS DE ESTOQUE
// ----------------------------------------------------
async function getInventory() {
  if (isNeonConnected) {
    const res = await pool.query('SELECT * FROM inventory ORDER BY name ASC');
    return res.rows;
  } else {
    const data = getLocalData();
    return data.inventory || DEFAULT_INVENTORY;
  }
}

async function createInventoryItem(item) {
  if (isNeonConnected) {
    const res = await pool.query(
      `INSERT INTO inventory (name, category, quantity, min_quantity, cost_price, supplier, last_restock)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [item.name, item.category, item.quantity || 0, item.min_quantity || 2, item.cost_price || 0, item.supplier || '', item.last_restock || new Date().toISOString().split('T')[0]]
    );
    return res.rows[0];
  } else {
    const data = getLocalData();
    if (!data.inventory) data.inventory = [];
    const newId = data.inventory.length > 0 ? Math.max(...data.inventory.map(i => i.id)) + 1 : 1;
    const newItem = { id: newId, ...item, last_restock: new Date().toISOString().split('T')[0] };
    data.inventory.push(newItem);
    saveLocalData(data);
    return newItem;
  }
}

async function updateInventoryItem(id, updates) {
  if (isNeonConnected) {
    const fields = [];
    const values = [];
    Object.keys(updates).forEach((key, idx) => {
      fields.push(`${key} = $${idx + 1}`);
      values.push(updates[key]);
    });
    values.push(id);
    const sql = `UPDATE inventory SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const res = await pool.query(sql, values);
    return res.rows[0];
  } else {
    const data = getLocalData();
    const idx = data.inventory.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return null;
    data.inventory[idx] = { ...data.inventory[idx], ...updates };
    saveLocalData(data);
    return data.inventory[idx];
  }
}

async function adjustInventoryQuantity(id, delta) {
  if (isNeonConnected) {
    const res = await pool.query('UPDATE inventory SET quantity = GREATEST(0, quantity + $1) WHERE id = $2 RETURNING *', [delta, id]);
    return res.rows[0] || null;
  } else {
    const data = getLocalData();
    const idx = data.inventory.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return null;
    data.inventory[idx].quantity = Math.max(0, (data.inventory[idx].quantity || 0) + delta);
    saveLocalData(data);
    return data.inventory[idx];
  }
}

async function deleteInventoryItem(id) {
  if (isNeonConnected) {
    const res = await pool.query('DELETE FROM inventory WHERE id = $1 RETURNING *', [id]);
    return res.rows[0] || null;
  } else {
    const data = getLocalData();
    const idx = data.inventory.findIndex(i => String(i.id) === String(id));
    if (idx === -1) return null;
    const removed = data.inventory.splice(idx, 1)[0];
    saveLocalData(data);
    return removed;
  }
}

// ----------------------------------------------------
// MÉTODOS DE DISPONIBILIDADE & HORÁRIOS
// ----------------------------------------------------
async function getAvailabilitySettings() {
  if (isNeonConnected) {
    const res = await pool.query("SELECT value FROM settings WHERE key = 'availability'");
    if (res.rows.length > 0) return res.rows[0].value;
    return DEFAULT_AVAILABILITY;
  } else {
    const data = getLocalData();
    return data.availability || DEFAULT_AVAILABILITY;
  }
}

async function updateAvailabilitySettings(settings) {
  if (isNeonConnected) {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('availability', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1`,
      [JSON.stringify(settings)]
    );
    return settings;
  } else {
    const data = getLocalData();
    data.availability = settings;
    saveLocalData(data);
    return data.availability;
  }
}

async function addBlockedDate(date, reason) {
  const current = await getAvailabilitySettings();
  if (!current.blocked_dates) current.blocked_dates = [];
  const newBlocked = { id: String(Date.now()), date, reason: reason || 'Folga' };
  current.blocked_dates.push(newBlocked);
  await updateAvailabilitySettings(current);
  return newBlocked;
}

async function deleteBlockedDate(idOrDate) {
  const current = await getAvailabilitySettings();
  if (!current.blocked_dates) return false;
  const beforeLen = current.blocked_dates.length;
  current.blocked_dates = current.blocked_dates.filter(b => b.id !== String(idOrDate) && b.date !== String(idOrDate));
  if (current.blocked_dates.length < beforeLen) {
    await updateAvailabilitySettings(current);
    return true;
  }
  return false;
}

async function getServices() {
  return DEFAULT_SERVICES;
}

module.exports = {
  initDb,
  getDbStatus,
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialMetrics,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  adjustInventoryQuantity,
  deleteInventoryItem,
  getAvailabilitySettings,
  updateAvailabilitySettings,
  addBlockedDate,
  deleteBlockedDate,
  getServices
};
