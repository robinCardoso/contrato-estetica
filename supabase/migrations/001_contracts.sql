-- Contratos estéticos: schema inicial
-- Execute no SQL Editor do Supabase: https://supabase.com/dashboard/project/_/sql
--
-- Assinatura da profissional: use a tabela perfis (coluna sig_profissional).
-- Rode também: supabase/migrations/002_integrate_perfis.sql

create extension if not exists pgcrypto;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  token text unique not null default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'draft' check (status in ('draft', 'sent', 'signed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  patient_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  plano_procedimentos text not null default '',
  plano_regioes text not null default '',
  plano_equipamentos text not null default '',
  plano_sessoes text not null default '',
  plano_disparos text not null default '',
  plano_ampolas text not null default '',
  valor_total text not null default '',
  plano_pagamento text not null default '',
  sig_profissional text,
  dia text not null default '',
  mes text not null default '',
  ano text not null default '',

  paciente_nome text not null default '',
  paciente_cpf text not null default '',
  paciente_rg text not null default '',
  paciente_telefone text not null default '',
  paciente_foto text,
  foto_auth text,
  sig_paciente text,
  signed_at timestamptz
);

create index if not exists contracts_token_idx on public.contracts(token);
create index if not exists contracts_created_by_idx on public.contracts(created_by);
create index if not exists contracts_status_idx on public.contracts(status);

alter table public.contracts enable row level security;

drop policy if exists "Users view own contracts" on public.contracts;
create policy "Users view own contracts"
  on public.contracts
  for select
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "Users insert own contracts" on public.contracts;
create policy "Users insert own contracts"
  on public.contracts
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Users update own contracts" on public.contracts;
create policy "Users update own contracts"
  on public.contracts
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Users delete own contracts" on public.contracts;
create policy "Users delete own contracts"
  on public.contracts
  for delete
  to authenticated
  using (created_by = auth.uid());

create or replace function public.get_contract_by_token(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data public.contracts%rowtype;
begin
  select * into row_data
  from public.contracts
  where token = p_token
    and status in ('sent', 'signed');

  if not found then
    return null;
  end if;

  return json_build_object(
    'token', row_data.token,
    'status', row_data.status,
    'plano_procedimentos', row_data.plano_procedimentos,
    'plano_regioes', row_data.plano_regioes,
    'plano_equipamentos', row_data.plano_equipamentos,
    'plano_sessoes', row_data.plano_sessoes,
    'plano_disparos', row_data.plano_disparos,
    'plano_ampolas', row_data.plano_ampolas,
    'valor_total', row_data.valor_total,
    'plano_pagamento', row_data.plano_pagamento,
    'sig_profissional', row_data.sig_profissional,
    'dia', row_data.dia,
    'mes', row_data.mes,
    'ano', row_data.ano,
    'paciente_nome', row_data.paciente_nome,
    'paciente_cpf', row_data.paciente_cpf,
    'paciente_rg', row_data.paciente_rg,
    'paciente_telefone', row_data.paciente_telefone,
    'paciente_foto', row_data.paciente_foto,
    'foto_auth', row_data.foto_auth,
    'sig_paciente', row_data.sig_paciente,
    'signed_at', row_data.signed_at
  );
end;
$$;

create or replace function public.update_contract_by_token(p_token text, p_payload jsonb)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.contracts%rowtype;
begin
  update public.contracts
  set
    paciente_nome = coalesce(nullif(p_payload->>'paciente_nome', ''), paciente_nome),
    paciente_cpf = coalesce(nullif(p_payload->>'paciente_cpf', ''), paciente_cpf),
    paciente_rg = coalesce(nullif(p_payload->>'paciente_rg', ''), paciente_rg),
    paciente_telefone = coalesce(nullif(p_payload->>'paciente_telefone', ''), paciente_telefone),
    paciente_foto = case
      when p_payload ? 'paciente_foto' then p_payload->>'paciente_foto'
      else paciente_foto
    end,
    foto_auth = coalesce(nullif(p_payload->>'foto_auth', ''), foto_auth),
    sig_paciente = case
      when p_payload ? 'sig_paciente' then p_payload->>'sig_paciente'
      else sig_paciente
    end,
    status = case
      when coalesce(p_payload->>'sig_paciente', '') <> '' then 'signed'
      else status
    end,
    signed_at = case
      when coalesce(p_payload->>'sig_paciente', '') <> '' and signed_at is null then now()
      else signed_at
    end,
    updated_at = now()
  where token = p_token
    and status in ('sent', 'signed')
  returning * into updated_row;

  if not found then
    return null;
  end if;

  return public.get_contract_by_token(p_token);
end;
$$;

revoke all on function public.get_contract_by_token(text) from public;
revoke all on function public.update_contract_by_token(text, jsonb) from public;
grant execute on function public.get_contract_by_token(text) to anon, authenticated;
grant execute on function public.update_contract_by_token(text, jsonb) to anon, authenticated;
