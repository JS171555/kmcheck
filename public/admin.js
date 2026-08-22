const $ = (id) => document.getElementById(id);
const form = $('vehicleForm');
const rows = $('historyRows');
const message = $('message');
const list = $('vehicleList');
const editingPlate = $('editingPlate');

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = `message${error ? ' error' : ''}`;
}
function hideMessage() { message.className = 'message hidden'; }

function rowHtml(item = {}) {
  return `<div class="history-row">
    <label>Data<input class="hist-date" type="date" value="${item.data || ''}" required></label>
    <label>KM<input class="hist-km" type="number" min="0" step="1" value="${item.km ?? ''}" placeholder="75000" required></label>
    <label>Situação<input class="hist-situation" value="${item.situacao || 'Aprovado'}"></label>
    <button class="remove-row" type="button">Remover</button>
  </div>`;
}

function addRow(item) {
  rows.insertAdjacentHTML('beforeend', rowHtml(item));
}
function collectHistory() {
  return [...document.querySelectorAll('.history-row')].map((row) => ({
    data: row.querySelector('.hist-date').value,
    km: Number(row.querySelector('.hist-km').value),
    modalidade: 'Vistoria',
    situacao: row.querySelector('.hist-situation').value.trim() || 'Aprovado'
  }));
}

function authHeaders(json = false) {
  const headers = { 'x-admin-key': $('adminKey').value.trim() };
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(Boolean(options.body)), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Erro na operação.');
  return data;
}

async function loadVehicles() {
  try {
    const data = await api('/api/admin/veiculos');
    list.innerHTML = data.data.length ? data.data.map((v) => `
      <article class="vehicle-item">
        <div><strong>${escapeHtml(v.placa)}</strong><span>${escapeHtml(v.nome || v.modelo || 'Modelo não informado')}</span></div>
        <div><small>${v.totalRegistros} registro(s)</small><b>${v.ultimoKm ? formatKm(v.ultimoKm) : '—'}</b></div>
        <div class="item-actions">
          <button class="secondary edit" data-plate="${v.placa}">Editar</button>
          <button class="danger delete" data-plate="${v.placa}">Excluir</button>
        </div>
      </article>`).join('') : '<p class="muted">Nenhum veículo cadastrado.</p>';
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function editVehicle(plate) {
  try {
    const data = await api(`/api/admin/veiculos/${encodeURIComponent(plate)}`);
    const v = data;
    $('placa').value = v.placa;
    $('placa').disabled = true;
    $('editingPlate').value = v.placa;
    $('nome').value = v.nome || '';
    $('marca').value = v.marca || '';
    $('modelo').value = v.modelo || '';
    $('anoModelo').value = v.anoModelo || '';
    $('tipo').value = v.tipo || 'Automóvel';
    rows.innerHTML = '';
    v.historico.forEach(addRow);
    $('save').textContent = 'Salvar alterações';
    $('cancelEdit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showMessage(error.message, true);
  }
}

function resetForm() {
  form.reset();
  $('placa').disabled = false;
  $('tipo').value = 'Automóvel';
  rows.innerHTML = '';
  addRow();
  $('save').textContent = 'Cadastrar veículo';
  $('cancelEdit').classList.add('hidden');
  editingPlate.value = '';
  hideMessage();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();
  const vehicle = {
    placa: $('placa').value,
    nome: $('nome').value,
    marca: $('marca').value,
    modelo: $('modelo').value,
    tipo: $('tipo').value,
    anoModelo: $('anoModelo').value ? Number($('anoModelo').value) : null,
    historico: collectHistory()
  };

  const isEdit = Boolean(editingPlate.value);
  const url = isEdit
    ? `/api/admin/veiculos/${encodeURIComponent(editingPlate.value)}`
    : '/api/admin/veiculos';

  try {
    await api(url, {
      method: isEdit ? 'PUT' : 'POST',
      body: JSON.stringify(vehicle)
    });
    showMessage(isEdit ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
    resetForm();
    await loadVehicles();
  } catch (error) {
    showMessage(error.message, true);
  }
});

async function validateAdminKey() {
  const key = $('adminKey').value.trim();

  if (!key) {
    hideMessage();
    return;
  }

  try {
    const response = await fetch(`/admin?key=${encodeURIComponent(key)}`);
    const text = await response.text();

    if (!response.ok) {
      let error = 'Chave administrativa inválida.';

      try {
        const data = JSON.parse(text);
        error = data.error || error;
      } catch {}

      showMessage(error, true);
      return;
    }

    showMessage(text); // mostra "OK"
  } catch (error) {
    showMessage('Erro ao validar chave.', true);
  }
}

$('addHistory').addEventListener('click', () => addRow());
$('cancelEdit').addEventListener('click', resetForm);
$('reload').addEventListener('click', loadVehicles);

rows.addEventListener('click', (event) => {
  if (event.target.classList.contains('remove-row')) {
    const all = document.querySelectorAll('.history-row');
    if (all.length > 1) event.target.closest('.history-row').remove();
  }
});
list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-plate]');
  if (!button) return;
  const plate = button.dataset.plate;
  if (button.classList.contains('edit')) return editVehicle(plate);
  if (button.classList.contains('delete')) {
    if (!confirm(`Excluir ${plate} da base do KMCheck?`)) return;
    try { await api(`/api/admin/veiculos/${encodeURIComponent(plate)}`, { method: 'DELETE' }); await loadVehicles(); }
    catch (error) { showMessage(error.message, true); }
  }
});

function formatKm(value) { return `${Math.round(value).toLocaleString('pt-BR')} km`; }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

addRow();

$('adminKey').addEventListener('blur', validateAdminKey);
