import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PLACEHOLDER_MARKERS = ['placeholder.supabase.co', 'SEU_PROJETO', 'sua_chave_anon'];

export function isSupabaseConfigured() {
  if (!supabaseUrl || !supabaseAnonKey) return false;
  const combined = `${supabaseUrl} ${supabaseAnonKey}`;
  return !PLACEHOLDER_MARKERS.some((marker) => combined.includes(marker));
}

export function supabaseConfigErrorMessage() {
  if (import.meta.env.PROD) {
    return 'Supabase não configurado no deploy. Adicione os secrets VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em Settings → Secrets and variables → Actions do repositório no GitHub e faça um novo deploy.';
  }
  return 'Configure o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (copie de .env.example).';
}

if (!isSupabaseConfigured()) {
  console.warn('Supabase não configurado. Copie .env.example para .env e preencha as variáveis.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

export const basePath = import.meta.env.VITE_BASE_PATH || '/';

export function contractUrl(token) {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const origin = window.location.origin;
  return `${origin}${base}contract.html?t=${token}`;
}

export async function getContractByToken(token) {
  const { data, error } = await supabase.rpc('get_contract_by_token', { p_token: token });
  if (error) throw error;
  return data;
}

export async function updateContractByToken(token, payload) {
  const { data, error } = await supabase.rpc('update_contract_by_token', {
    p_token: token,
    p_payload: payload,
  });
  if (error) throw error;
  return data;
}
