const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta raiz e public
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------------------------------------
// ROTAS DE STATUS & CONFIGURAÇÃO
// ----------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    await db.initDb();
    res.json({
      status: 'online',
      timestamp: new Date().toISOString(),
      db: db.getDbStatus()
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.get('/api/config/db-status', async (req, res) => {
  await db.initDb();
  res.json(db.getDbStatus());
});

// ----------------------------------------------------
// ROTAS DE AGENDAMENTOS (CRUD COMPLETO)
// ----------------------------------------------------
app.get('/api/appointments', async (req, res) => {
  try {
    const { status, date, startDate, endDate, search } = req.query;
    const appointments = await db.getAppointments({ status, date, startDate, endDate, search });
    res.json({ success: true, count: appointments.length, data: appointments });
  } catch (err) {
    console.error('Erro ao buscar agendamentos:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar agendamentos.' });
  }
});

app.get('/api/appointments/:id', async (req, res) => {
  try {
    const appointment = await db.getAppointmentById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado.' });
    }
    res.json({ success: true, data: appointment });
  } catch (err) {
    console.error('Erro ao buscar agendamento:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar agendamento.' });
  }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { client_name, client_phone, service_id, service_name, price, appointment_date, appointment_time, notes, payment_status, payment_method, status } = req.body;

    if (!client_name || !client_phone || !service_name || !appointment_date || !appointment_time) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: client_name, client_phone, service_name, appointment_date, appointment_time.'
      });
    }

    const created = await db.createAppointment({
      client_name,
      client_phone,
      service_id,
      service_name,
      price: parseFloat(price) || 0,
      appointment_date,
      appointment_time,
      notes,
      payment_status: payment_status || 'pendente',
      payment_method: payment_method || 'pix',
      status: status || 'pendente'
    });

    res.status(201).json({ success: true, message: 'Agendamento criado com sucesso!', data: created });
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao salvar agendamento.' });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  try {
    const updated = await db.updateAppointment(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado.' });
    }
    res.json({ success: true, message: 'Agendamento atualizado com sucesso!', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar agendamento:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao atualizar agendamento.' });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const removed = await db.deleteAppointment(req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Agendamento não encontrado.' });
    }
    res.json({ success: true, message: 'Agendamento removido com sucesso!', data: removed });
  } catch (err) {
    console.error('Erro ao excluir agendamento:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao excluir agendamento.' });
  }
});

// ----------------------------------------------------
// ROTAS DO FINANCEIRO (CRUD & MÉTRICAS)
// ----------------------------------------------------
app.get('/api/finances', async (req, res) => {
  try {
    const { type, category, startDate, endDate, date } = req.query;
    const transactions = await db.getTransactions({ type, category, startDate, endDate, date });
    res.json({ success: true, count: transactions.length, data: transactions });
  } catch (err) {
    console.error('Erro ao buscar financeiro:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados financeiros.' });
  }
});

app.post('/api/finances', async (req, res) => {
  try {
    const { type, category, description, amount, date, payment_method, status } = req.body;

    if (!type || !description || amount === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: type (receita/despesa), description, amount.'
      });
    }

    const created = await db.createTransaction({
      type,
      category: category || (type === 'receita' ? 'Atendimento' : 'Geral'),
      description,
      amount: parseFloat(amount),
      date: date || new Date().toISOString().split('T')[0],
      payment_method: payment_method || 'pix',
      status: status || 'pago'
    });

    res.status(201).json({ success: true, message: 'Lançamento financeiro registrado!', data: created });
  } catch (err) {
    console.error('Erro ao criar transação financeira:', err);
    res.status(500).json({ success: false, error: 'Erro interno ao salvar transação.' });
  }
});

app.put('/api/finances/:id', async (req, res) => {
  try {
    const updated = await db.updateTransaction(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
    }
    res.json({ success: true, message: 'Lançamento atualizado!', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar transação:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar transação.' });
  }
});

app.delete('/api/finances/:id', async (req, res) => {
  try {
    const removed = await db.deleteTransaction(req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Transação não encontrada.' });
    }
    res.json({ success: true, message: 'Lançamento excluído!', data: removed });
  } catch (err) {
    console.error('Erro ao excluir transação:', err);
    res.status(500).json({ success: false, error: 'Erro ao excluir transação.' });
  }
});

app.get('/api/finances/metrics', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    const metrics = await db.getFinancialMetrics(period || 'mes', startDate, endDate);
    res.json({ success: true, data: metrics });
  } catch (err) {
    console.error('Erro ao calcular métricas:', err);
    res.status(500).json({ success: false, error: 'Erro ao processar métricas financeiras.' });
  }
});

// ----------------------------------------------------
// ROTAS DE CONTROLE DE ESTOQUE (INVENTORY)
// ----------------------------------------------------
app.get('/api/inventory', async (req, res) => {
  try {
    const items = await db.getInventory();
    res.json({ success: true, count: items.length, data: items });
  } catch (err) {
    console.error('Erro ao buscar estoque:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar itens de estoque.' });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const { name, category, quantity, min_quantity, cost_price, supplier, last_restock } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nome do produto é obrigatório.' });
    }

    const created = await db.createInventoryItem({
      name,
      category,
      quantity,
      min_quantity,
      cost_price,
      supplier,
      last_restock
    });

    res.status(201).json({ success: true, message: 'Produto cadastrado no estoque!', data: created });
  } catch (err) {
    console.error('Erro ao criar item de estoque:', err);
    res.status(500).json({ success: false, error: 'Erro ao cadastrar produto no estoque.' });
  }
});

app.put('/api/inventory/:id', async (req, res) => {
  try {
    const updated = await db.updateInventoryItem(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
    }
    res.json({ success: true, message: 'Estoque atualizado!', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar estoque:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar produto no estoque.' });
  }
});

app.post('/api/inventory/:id/adjust', async (req, res) => {
  try {
    const { delta } = req.body;
    const adjusted = await db.adjustInventoryQuantity(req.params.id, delta);
    if (!adjusted) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
    }
    res.json({ success: true, message: 'Quantidade ajustada!', data: adjusted });
  } catch (err) {
    console.error('Erro ao ajustar quantidade:', err);
    res.status(500).json({ success: false, error: 'Erro ao ajustar estoque.' });
  }
});

app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const removed = await db.deleteInventoryItem(req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Produto não encontrado.' });
    }
    res.json({ success: true, message: 'Produto removido do estoque!', data: removed });
  } catch (err) {
    console.error('Erro ao excluir do estoque:', err);
    res.status(500).json({ success: false, error: 'Erro ao remover produto.' });
  }
});

// ----------------------------------------------------
// ROTAS DE HORÁRIOS & DIAS DE ATENDIMENTO / FOLGAS
// ----------------------------------------------------
app.get('/api/availability', async (req, res) => {
  try {
    const availability = await db.getAvailabilitySettings();
    res.json({ success: true, data: availability });
  } catch (err) {
    console.error('Erro ao buscar disponibilidade:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar horários e dias.' });
  }
});

app.put('/api/availability', async (req, res) => {
  try {
    const updated = await db.updateAvailabilitySettings(req.body);
    res.json({ success: true, message: 'Configurações de horários e dias atualizadas!', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar disponibilidade:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar horários.' });
  }
});

app.post('/api/availability/blocked-dates', async (req, res) => {
  try {
    const { date, reason } = req.body;
    if (!date) {
      return res.status(400).json({ success: false, error: 'Data é obrigatória.' });
    }
    const blocked = await db.addBlockedDate(date, reason);
    res.status(201).json({ success: true, message: 'Data bloqueada com sucesso!', data: blocked });
  } catch (err) {
    console.error('Erro ao bloquear data:', err);
    res.status(500).json({ success: false, error: 'Erro ao bloquear dia de atendimento.' });
  }
});

app.delete('/api/availability/blocked-dates/:id', async (req, res) => {
  try {
    const unblocked = await db.deleteBlockedDate(req.params.id);
    if (!unblocked) {
      return res.status(404).json({ success: false, error: 'Data bloqueada não encontrada.' });
    }
    res.json({ success: true, message: 'Data desbloqueada com sucesso!', data: unblocked });
  } catch (err) {
    console.error('Erro ao desbloquear data:', err);
    res.status(500).json({ success: false, error: 'Erro ao desbloquear dia.' });
  }
});

// ----------------------------------------------------
// ROTAS DE SERVIÇOS & PÁGINAS
// ----------------------------------------------------
app.get('/api/services', async (req, res) => {
  try {
    const config = await db.getServicesSettings();
    res.json({ success: true, data: config.services, show_prices: config.show_prices });
  } catch (err) {
    console.error('Erro ao buscar serviços:', err);
    res.status(500).json({ success: false, error: 'Erro ao buscar catálogo de serviços.' });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const { name, duration, price, description, category } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Nome do serviço é obrigatório.' });
    }
    const created = await db.createService({ name, duration, price, description, category });
    res.status(201).json({ success: true, message: 'Serviço criado com sucesso!', data: created });
  } catch (err) {
    console.error('Erro ao criar serviço:', err);
    res.status(500).json({ success: false, error: 'Erro ao criar serviço.' });
  }
});

app.put('/api/services/settings/toggle-prices', async (req, res) => {
  try {
    const { show_prices } = req.body;
    const updated = await db.toggleShowPrices(show_prices);
    res.json({ success: true, message: 'Exibição de preços atualizada!', show_prices: updated });
  } catch (err) {
    console.error('Erro ao alterar exibição de preços:', err);
    res.status(500).json({ success: false, error: 'Erro ao alterar exibição de preços.' });
  }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const updated = await db.updateService(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Serviço não encontrado.' });
    }
    res.json({ success: true, message: 'Serviço atualizado com sucesso!', data: updated });
  } catch (err) {
    console.error('Erro ao atualizar serviço:', err);
    res.status(500).json({ success: false, error: 'Erro ao atualizar serviço.' });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const removed = await db.deleteService(req.params.id);
    if (!removed) {
      return res.status(404).json({ success: false, error: 'Serviço não encontrado.' });
    }
    res.json({ success: true, message: 'Serviço removido com sucesso!', data: removed });
  } catch (err) {
    console.error('Erro ao excluir serviço:', err);
    res.status(500).json({ success: false, error: 'Erro ao excluir serviço.' });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.get('/agendar', (req, res) => res.sendFile(path.join(__dirname, 'agendamento.html')));
app.get('/agendamento.html', (req, res) => res.sendFile(path.join(__dirname, 'agendamento.html')));

// Inicialização Local ou Serverless
if (!process.env.VERCEL) {
  db.initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`✨ Servidor Geovanna Macedo rodando com sucesso na porta ${PORT}!`);
    });
  }).catch((err) => {
    console.error('Erro ao iniciar DB localmente:', err);
    app.listen(PORT, () => {
      console.log(`✨ Servidor Geovanna Macedo rodando com contingência na porta ${PORT}!`);
    });
  });
}

// Exporta o aplicativo Express para o Vercel Serverless Function
module.exports = app;
