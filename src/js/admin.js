import { supabase, contractUrl } from './supabase.js';

const loginSection = document.getElementById('login-section');
const appSection = document.getElementById('app-section');
const alertBox = document.getElementById('alert-box');
const contractsList = document.getElementById('contracts-list');
const btnLogout = document.getElementById('btn-logout');

const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

let signaturePad = null;

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

function initSignaturePad() {
  const canvas = document.getElementById('sig-canvas');
  const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
  canvas.width = canvas.offsetWidth * ratio;
  canvas.height = canvas.offsetHeight * ratio;
  canvas.getContext('2d').scale(ratio, ratio);

  signaturePad = new SignaturePad(canvas, {
    penColor: 'rgb(0, 0, 128)',
    backgroundColor: 'rgba(255,255,255,0)',
    minWidth: 1.2,
    maxWidth: 3,
  });
}

async function loadSavedSignature(userId) {
  const { data } = await supabase
    .from('professional_profiles')
    .select('sig_profissional')
    .eq('user_id', userId)
    .maybeSingle();

  return data?.sig_profissional || null;
}

async function saveProfileSignature(userId, sig) {
  await supabase.from('professional_profiles').upsert({
    user_id: userId,
    sig_profissional: sig,
    updated_at: new Date().toISOString(),
  });
}

function setLoggedIn(isLoggedIn) {
  loginSection.classList.toggle('hidden', isLoggedIn);
  appSection.classList.toggle('hidden', !isLoggedIn);
  btnLogout.classList.toggle('hidden', !isLoggedIn);
}

async function loadContracts() {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, token, status, patient_label, paciente_nome, created_at, signed_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    contractsList.textContent = 'Erro ao carregar contratos.';
    return;
  }

  if (!data.length) {
    contractsList.innerHTML = '<p class="text-slate-400">Nenhum contrato criado ainda.</p>';
    return;
  }

  contractsList.innerHTML = data.map((item) => {
    const label = item.paciente_nome || item.patient_label || 'Sem identificação';
    const statusLabel = item.status === 'signed' ? 'Assinado' : item.status === 'sent' ? 'Aguardando' : 'Rascunho';
    const link = contractUrl(item.token);
    return `
      <div class="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div>
          <p class="font-medium text-slate-800">${label}</p>
          <p class="text-xs text-slate-500">${statusLabel} · ${new Date(item.created_at).toLocaleString('pt-BR')}</p>
        </div>
        <button type="button" data-link="${link}" class="copy-item-link text-xs bg-slate-900 text-white rounded-lg px-3 py-1.5">Copiar link</button>
      </div>
    `;
  }).join('');

  contractsList.querySelectorAll('.copy-item-link').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.link);
      showAlert('Link copiado!', 'success');
    });
  });
}

async function bootstrap() {
  if (!import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('SEU_PROJETO')) {
    showAlert('Configure o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
    return;
  }

  fillCurrentDate();
  initSignaturePad();

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    setLoggedIn(true);
    const savedSig = await loadSavedSignature(session.user.id);
    if (savedSig) signaturePad.fromDataURL(savedSig);
    await loadContracts();
  }

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      showAlert(error.message);
      return;
    }

    setLoggedIn(true);
    const savedSig = await loadSavedSignature(data.user.id);
    if (savedSig) signaturePad.fromDataURL(savedSig);
    await loadContracts();
  });

  btnLogout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    setLoggedIn(false);
    hideAlert();
  });

  document.getElementById('btn-clear-sig').addEventListener('click', () => signaturePad.clear());

  document.getElementById('btn-load-sig').addEventListener('click', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const savedSig = await loadSavedSignature(session.user.id);
    if (savedSig) {
      signaturePad.fromDataURL(savedSig);
      showAlert('Assinatura carregada.', 'success');
    } else {
      showAlert('Nenhuma assinatura salva encontrada.');
    }
  });

  document.getElementById('btn-copy-link').addEventListener('click', async () => {
    const link = document.getElementById('generated-link').value;
    await navigator.clipboard.writeText(link);
    showAlert('Link copiado!', 'success');
  });

  document.getElementById('contract-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      showAlert('Faça login novamente.');
      return;
    }

    if (signaturePad.isEmpty()) {
      showAlert('Assine o contrato antes de gerar o link.');
      return;
    }

    const sigData = signaturePad.toDataURL('image/png');
    const payload = {
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

    const btn = document.getElementById('btn-create');
    btn.disabled = true;
    btn.textContent = 'Gerando...';

    const { data, error } = await supabase.from('contracts').insert(payload).select('token').single();

    btn.disabled = false;
    btn.textContent = 'Gerar link para paciente';

    if (error) {
      showAlert(error.message);
      return;
    }

    await saveProfileSignature(session.user.id, sigData);

    const link = contractUrl(data.token);
    document.getElementById('generated-link').value = link;
    document.getElementById('link-result').classList.remove('hidden');
    showAlert('Contrato criado! Envie o link para a paciente.', 'success');
    await loadContracts();
  });
}

bootstrap();
