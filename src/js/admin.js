import { supabase, contractUrl } from './supabase.js';

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const alertBox = document.getElementById('alert-box');
const contractsList = document.getElementById('contracts-list');
const btnLogout = document.getElementById('btn-logout');

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

let signaturePad = null;
let loadedSignatureDataUrl = null;
let editingContractId = null;

const SIG_MAX_WIDTH = 600;

const adminFieldMap = {
  patient_label: 'patient-label',
  plano_procedimentos: 'plano-procedimentos',
  plano_regioes: 'plano-regioes',
  plano_equipamentos: 'plano-equipamentos',
  plano_sessoes: 'plano-sessoes',
  plano_disparos: 'plano-disparos',
  plano_ampolas: 'plano-ampolas',
  valor_total: 'valor-total',
  plano_pagamento: 'plano-pagamento',
  dia: 'dia',
  mes: 'mes',
  ano: 'ano',
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAlert(message, type = 'error') {
  alertBox.textContent = message;
  alertBox.className = `mb-4 rounded-lg border px-4 py-3 text-sm ${
    type === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
  }`;
  alertBox.classList.remove('hidden');
}

function hideAlert() {
  alertBox.classList.add('hidden');
}

function fillCurrentDate() {
  const hoje = new Date();
  document.getElementById('dia').value = String(hoje.getDate()).padStart(2, '0');
  document.getElementById('mes').value = meses[hoje.getMonth()];
  document.getElementById('ano').value = String(hoje.getFullYear()).slice(-2);
}

function getSignatureCanvasDimensions() {
  const canvas = document.getElementById('sig-canvas');
  const width = canvas.offsetWidth || canvas.parentElement?.clientWidth || 300;
  const height = canvas.offsetHeight || 140;
  return {
    width: Math.max(width, 1),
    height: Math.max(height, 1),
  };
}

function initSignaturePad() {
  const canvas = document.getElementById('sig-canvas');
  const { width, height } = getSignatureCanvasDimensions();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);

  if (signaturePad) {
    signaturePad.off();
  }

  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);

  signaturePad = new SignaturePad(canvas, {
    penColor: 'rgb(0, 0, 128)',
    backgroundColor: 'rgba(255,255,255,0)',
    minWidth: 1.2,
    maxWidth: 3,
  });

  signaturePad.addEventListener('endStroke', () => {
    loadedSignatureDataUrl = null;
  });
}

function ensureSignaturePad() {
  const canvas = document.getElementById('sig-canvas');
  const { width, height } = getSignatureCanvasDimensions();
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  const expectedWidth = Math.round(width * ratio);
  const expectedHeight = Math.round(height * ratio);

  if (!signaturePad || canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
    initSignaturePad();
  }
}

function compressSignatureImage(file, maxWidth = SIG_MAX_WIDTH, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Imagem inválida.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function isValidSignatureDataUrl(dataUrl) {
  return typeof dataUrl === 'string' && /^data:image\/(png|jpeg|jpg);/i.test(dataUrl);
}

async function applySignatureToPad(dataUrl, { keepOnFailure = false } = {}) {
  if (!isValidSignatureDataUrl(dataUrl)) {
    console.warn('Assinatura inválida ou ausente.');
    return false;
  }

  ensureSignaturePad();
  const { width, height } = getSignatureCanvasDimensions();

  try {
    signaturePad.clear();
    await signaturePad.fromDataURL(dataUrl, {
      ratio: 1,
      width,
      height,
    });
    loadedSignatureDataUrl = dataUrl;
    return true;
  } catch (err) {
    console.warn('Não foi possível aplicar assinatura no canvas:', err);
    signaturePad.clear();
    loadedSignatureDataUrl = keepOnFailure ? dataUrl : null;
    return false;
  }
}

function getSignatureDataUrl() {
  if (signaturePad && !signaturePad.isEmpty()) {
    return signaturePad.toDataURL('image/png');
  }
  return loadedSignatureDataUrl;
}

async function loadSavedSignature(userId) {
  const { data } = await supabase
    .from('perfis')
    .select('sig_profissional')
    .eq('id', userId)
    .maybeSingle();

  return data?.sig_profissional || null;
}

async function saveProfileSignature(userId, sig) {
  await supabase
    .from('perfis')
    .update({ sig_profissional: sig })
    .eq('id', userId);
}

function setLoggedIn(isLoggedIn) {
  loginSection.classList.toggle('hidden', isLoggedIn);
  appSection.classList.toggle('hidden', !isLoggedIn);
  btnLogout.classList.toggle('hidden', !isLoggedIn);
}

function setContractsListLoading() {
  contractsList.innerHTML = '<p class="text-slate-400">Carregando...</p>';
}

function setContractsListIdle() {
  contractsList.innerHTML = '<p class="text-slate-400">Faça login para ver seus contratos.</p>';
}

function setContractsListEmpty() {
  contractsList.innerHTML = '<p class="text-slate-400">Nenhum contrato.</p>';
}

function setContractsListError(message) {
  contractsList.innerHTML = `<p class="text-rose-600">${escapeHtml(message)}</p>`;
}

async function fetchContractById(id) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

function formatField(label, value) {
  if (!value) return '';
  return `<div><p class="text-xs font-medium text-slate-500">${escapeHtml(label)}</p><p class="text-slate-800">${escapeHtml(value)}</p></div>`;
}

function formatSignatureBlock(label, dataUrl) {
  if (!dataUrl) {
    return `<div><p class="text-xs font-medium text-slate-500 mb-1">${label}</p><p class="text-slate-400 italic">Não registrada</p></div>`;
  }
  return `
    <div>
      <p class="text-xs font-medium text-slate-500 mb-1">${label}</p>
      <img src="${dataUrl}" alt="${label}" class="max-h-24 border rounded-lg bg-slate-50">
    </div>
  `;
}

function openViewModal(contract) {
  const label = contract.paciente_nome || contract.patient_label || 'Sem identificação';
  const signedAt = contract.signed_at
    ? new Date(contract.signed_at).toLocaleString('pt-BR')
    : '—';

  const planFields = [
    ['Procedimento(s)', contract.plano_procedimentos],
    ['Região(ões)', contract.plano_regioes],
    ['Equipamento/Produto', contract.plano_equipamentos],
    ['Sessões', contract.plano_sessoes],
    ['Disparos', contract.plano_disparos],
    ['Ampolas/Seringas/Frascos', contract.plano_ampolas],
    ['Valor total', contract.valor_total ? `R$ ${contract.valor_total}` : ''],
    ['Forma de pagamento', contract.plano_pagamento],
    ['Data', [contract.dia, contract.mes, contract.ano].filter(Boolean).join(' / ')],
  ].map(([lbl, val]) => formatField(lbl, val)).join('');

  const photoBlock = contract.paciente_foto
    ? `<div>
        <p class="text-xs font-medium text-slate-500 mb-1">Foto da paciente</p>
        <a href="${contract.paciente_foto}" target="_blank" rel="noopener" class="inline-block">
          <img src="${contract.paciente_foto}" alt="Foto da paciente" class="max-h-32 border rounded-lg">
        </a>
      </div>`
    : '';

  document.getElementById('view-modal-body').innerHTML = `
    <div class="space-y-3">
      <p class="font-medium text-slate-900 text-base">${escapeHtml(label)}</p>
      ${formatField('CPF', contract.paciente_cpf)}
      ${formatField('Telefone', contract.paciente_telefone)}
      ${formatField('Assinado em', signedAt)}
    </div>
    <hr class="border-slate-200">
    <div class="grid gap-3">${planFields}</div>
    ${photoBlock ? `<hr class="border-slate-200">${photoBlock}` : ''}
    <hr class="border-slate-200">
    <div class="grid sm:grid-cols-2 gap-4">
      ${formatSignatureBlock('Assinatura da paciente', contract.sig_paciente)}
      ${formatSignatureBlock('Assinatura da profissional', contract.sig_profissional)}
    </div>
  `;

  document.getElementById('view-modal').classList.remove('hidden');
}

function closeViewModal() {
  document.getElementById('view-modal').classList.add('hidden');
}

function fillFormFromContract(contract) {
  Object.entries(adminFieldMap).forEach(([dbKey, elId]) => {
    const el = document.getElementById(elId);
    if (el && contract[dbKey] != null) {
      el.value = contract[dbKey];
    }
  });
}

function clearFormFields() {
  document.getElementById('contract-form').reset();
  fillCurrentDate();
  if (signaturePad) {
    signaturePad.clear();
  }
  loadedSignatureDataUrl = null;
}

function setEditMode(contract) {
  editingContractId = contract.id;
  const label = contract.patient_label || contract.paciente_nome || 'Sem identificação';
  document.getElementById('edit-banner').classList.remove('hidden');
  document.getElementById('edit-banner-text').textContent = `Editando contrato: ${label}`;
  document.getElementById('form-title').textContent = 'Editar contrato';
  document.getElementById('btn-create').textContent = 'Salvar alterações';
  document.getElementById('link-result').classList.add('hidden');
  document.getElementById('contract-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFormToNew() {
  editingContractId = null;
  document.getElementById('edit-banner').classList.add('hidden');
  document.getElementById('form-title').textContent = 'Novo contrato';
  document.getElementById('btn-create').textContent = 'Gerar link para paciente';
  document.getElementById('link-result').classList.add('hidden');
  clearFormFields();
}

async function restoreSavedSignature() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  await restoreSignatureForUser(session.user.id);
}

async function restoreSignatureForUser(userId) {
  try {
    const savedSig = await loadSavedSignature(userId);
    if (!savedSig) return;

    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    await applySignatureToPad(savedSig);
  } catch (err) {
    console.warn('Não foi possível restaurar assinatura salva:', err);
  }
}

async function startEditContract(id) {
  try {
    hideAlert();
    const contract = await fetchContractById(id);
    if (contract.status !== 'sent') {
      showAlert('Apenas contratos aguardando assinatura podem ser editados.');
      return;
    }

    ensureSignaturePad();
    fillFormFromContract(contract);
    setEditMode(contract);

    if (contract.sig_profissional) {
      await applySignatureToPad(contract.sig_profissional, { keepOnFailure: true });
    } else {
      signaturePad.clear();
      loadedSignatureDataUrl = null;
    }
  } catch (err) {
    showAlert(err.message || 'Erro ao carregar contrato para edição.');
  }
}

async function startViewContract(id) {
  try {
    const contract = await fetchContractById(id);
    if (contract.status !== 'signed') {
      showAlert('Este contrato ainda não foi assinado.');
      return;
    }
    openViewModal(contract);
  } catch (err) {
    showAlert(err.message || 'Erro ao carregar contrato.');
  }
}

function buildContractPayload(session, sigData) {
  return {
    created_by: session.user.id,
    status: 'sent',
    patient_label: document.getElementById('patient-label').value.trim(),
    plano_procedimentos: document.getElementById('plano-procedimentos').value.trim(),
    plano_regioes: document.getElementById('plano-regioes').value.trim(),
    plano_equipamentos: document.getElementById('plano-equipamentos').value.trim(),
    plano_sessoes: document.getElementById('plano-sessoes').value.trim(),
    plano_disparos: document.getElementById('plano-disparos').value.trim(),
    plano_ampolas: document.getElementById('plano-ampolas').value.trim(),
    valor_total: document.getElementById('valor-total').value.trim(),
    plano_pagamento: document.getElementById('plano-pagamento').value.trim(),
    dia: document.getElementById('dia').value.trim(),
    mes: document.getElementById('mes').value.trim(),
    ano: document.getElementById('ano').value.trim(),
    sig_profissional: sigData,
  };
}

async function loadContracts() {
  setContractsListLoading();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setContractsListIdle();
      return;
    }

    const { data, error } = await supabase
      .from('contracts')
      .select('id, token, status, patient_label, paciente_nome, created_at, signed_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      const hint = error.code === '42501'
        ? ' Sem permissão para ler contratos — verifique as políticas RLS no Supabase.'
        : '';
      setContractsListError(`Erro ao carregar contratos: ${error.message}.${hint}`);
      return;
    }

    if (!data?.length) {
      setContractsListEmpty();
      return;
    }

    contractsList.innerHTML = data.map((item) => {
    const label = escapeHtml(item.paciente_nome || item.patient_label || 'Sem identificação');
    const statusLabel = item.status === 'signed' ? 'Assinado' : item.status === 'sent' ? 'Aguardando' : 'Rascunho';
    const link = contractUrl(item.token);

    const editBtn = item.status === 'sent'
      ? `<button type="button" data-id="${item.id}" class="btn-edit-contract text-xs border border-slate-300 text-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-50">Editar</button>`
      : '';

    const viewBtn = item.status === 'signed'
      ? `<button type="button" data-id="${item.id}" class="btn-view-contract text-xs border border-slate-300 text-slate-700 rounded-lg px-3 py-1.5 hover:bg-slate-50">Visualizar</button>`
      : '';

    return `
      <div class="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <p class="font-medium text-slate-800">${label}</p>
          <p class="text-xs text-slate-500">${statusLabel} · ${new Date(item.created_at).toLocaleString('pt-BR')}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-link="${link}" class="copy-item-link text-xs bg-slate-900 text-white rounded-lg px-3 py-1.5">Copiar link</button>
          ${editBtn}
          ${viewBtn}
        </div>
      </div>
    `;
    }).join('');

    contractsList.querySelectorAll('.copy-item-link').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(btn.dataset.link);
        showAlert('Link copiado!', 'success');
      });
    });

    contractsList.querySelectorAll('.btn-edit-contract').forEach((btn) => {
      btn.addEventListener('click', () => startEditContract(btn.dataset.id));
    });

    contractsList.querySelectorAll('.btn-view-contract').forEach((btn) => {
      btn.addEventListener('click', () => startViewContract(btn.dataset.id));
    });
  } catch (err) {
    setContractsListError(err.message || 'Erro inesperado ao carregar contratos.');
  }
}

async function handleAuthSession(session) {
  if (!session) {
    setLoggedIn(false);
    setContractsListIdle();
    return;
  }

  setLoggedIn(true);
  ensureSignaturePad();
  await loadContracts();
  void restoreSignatureForUser(session.user.id);
}

async function bootstrap() {
  if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('SEU_PROJETO')) {
    showAlert('Configure o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    setContractsListError('Supabase não configurado. Verifique o arquivo .env.');
    return;
  }

  fillCurrentDate();
  setContractsListIdle();

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
      void handleAuthSession(session);
    } else if (event === 'SIGNED_OUT') {
      void handleAuthSession(null);
    }
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAlert(error.message);
    }
  });

  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    hideAlert();
  });

  document.getElementById('btn-clear-sig').addEventListener('click', () => {
    ensureSignaturePad();
    signaturePad.clear();
    loadedSignatureDataUrl = null;
  });

  document.getElementById('btn-load-sig').addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const savedSig = await loadSavedSignature(session.user.id);
    if (!savedSig) {
      showAlert('Nenhuma assinatura salva encontrada.');
      return;
    }

    const applied = await applySignatureToPad(savedSig);
    if (applied) {
      showAlert('Assinatura carregada.', 'success');
    } else {
      showAlert('Assinatura salva encontrada, mas não foi possível exibir no canvas. Tente carregar a foto novamente.');
    }
  });

  const sigFileInput = document.getElementById('sig-file-input');

  document.getElementById('btn-upload-sig').addEventListener('click', () => {
    sigFileInput.click();
  });

  sigFileInput.addEventListener('change', async () => {
    const file = sigFileInput.files?.[0];
    sigFileInput.value = '';
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      showAlert('Use uma imagem PNG ou JPG.');
      return;
    }

    try {
      ensureSignaturePad();
      const dataUrl = await compressSignatureImage(file);
      await applySignatureToPad(dataUrl);
      showAlert('Foto da assinatura carregada. Clique em "Salvar assinatura no perfil" para guardar.', 'success');
    } catch (err) {
      showAlert(err.message || 'Erro ao processar a imagem.');
    }
  });

  document.getElementById('btn-save-sig').addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showAlert('Faça login novamente.');
      return;
    }

    const sigData = getSignatureDataUrl();
    if (!sigData) {
      showAlert('Desenhe ou carregue uma assinatura antes de salvar.');
      return;
    }

    const { error } = await supabase
      .from('perfis')
      .update({ sig_profissional: sigData })
      .eq('id', session.user.id);

    if (error) {
      showAlert(error.message);
      return;
    }

    loadedSignatureDataUrl = sigData;
    showAlert('Assinatura salva no perfil.', 'success');
  });

  document.getElementById('btn-copy-link').addEventListener('click', async () => {
    const link = document.getElementById('generated-link').value;
    await navigator.clipboard.writeText(link);
    showAlert('Link copiado!', 'success');
  });

  document.getElementById('btn-cancel-edit').addEventListener('click', async () => {
    resetFormToNew();
    await restoreSavedSignature();
    hideAlert();
  });

  document.getElementById('btn-close-view').addEventListener('click', closeViewModal);

  document.getElementById('view-modal').addEventListener('click', (e) => {
    if (e.target.id === 'view-modal') closeViewModal();
  });

  document.getElementById('contract-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showAlert('Faça login novamente.');
      return;
    }

    const sigData = getSignatureDataUrl();
    if (!sigData) {
      showAlert('Assine o contrato antes de gerar o link.');
      return;
    }

    const payload = buildContractPayload(session, sigData);
    const btn = document.getElementById('btn-create');
    const isEditing = Boolean(editingContractId);

    btn.disabled = true;
    btn.textContent = isEditing ? 'Salvando...' : 'Gerando...';

    let result;
    if (isEditing) {
      const { data, error } = await supabase
        .from('contracts')
        .update(payload)
        .eq('id', editingContractId)
        .eq('status', 'sent')
        .select('token')
        .single();
      result = { data, error };
    } else {
      const { data, error } = await supabase.from('contracts').insert(payload).select('token').single();
      result = { data, error };
    }

    btn.disabled = false;
    btn.textContent = isEditing ? 'Salvar alterações' : 'Gerar link para paciente';

    if (result.error) {
      showAlert(result.error.message);
      return;
    }

    await saveProfileSignature(session.user.id, sigData);

    if (isEditing) {
      showAlert('Contrato atualizado com sucesso!', 'success');
      resetFormToNew();
      await restoreSavedSignature();
    } else {
      const link = contractUrl(result.data.token);
      document.getElementById('generated-link').value = link;
      document.getElementById('link-result').classList.remove('hidden');
      showAlert('Contrato criado! Envie o link para a paciente.', 'success');
    }

    await loadContracts();
  });
}

bootstrap();
