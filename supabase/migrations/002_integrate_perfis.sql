-- Integração com tabela perfis existente (assinatura da profissional)
-- Execute no SQL Editor do Supabase após 001_contracts.sql

alter table public.perfis
  add column if not exists sig_profissional text;

comment on column public.perfis.sig_profissional is
  'Assinatura digital da profissional (data URL PNG), reutilizada em contratos.';

-- RLS: políticas para leitura/escrita do próprio perfil (inclui sig_profissional).
-- Se perfis já tem políticas equivalentes (id = auth.uid()), pode ignorar este bloco.
alter table public.perfis enable row level security;

drop policy if exists "perfis_select_own" on public.perfis;
create policy "perfis_select_own"
  on public.perfis
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "perfis_update_own" on public.perfis;
create policy "perfis_update_own"
  on public.perfis
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
