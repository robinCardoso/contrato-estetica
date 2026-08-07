# Contrato de Estética — Links únicos por paciente

Sistema para a profissional criar contratos com assinatura pré-preenchida e enviar um **link exclusivo** para cada paciente assinar.

## Estrutura

| Página | URL | Quem usa |
|--------|-----|----------|
| Admin | `/admin.html` | Profissional (login) |
| Contrato | `/contract.html?t=TOKEN` | Paciente |

## Configuração do Supabase

### 1. Executar a migração SQL

No [SQL Editor](https://supabase.com/dashboard/project/_/sql) do seu projeto, execute o arquivo:

`supabase/migrations/001_contracts.sql`

### 2. Criar usuário da profissional

No Supabase: **Authentication → Users → Add user**

Crie um e-mail e senha que só a profissional conheça.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_BASE_PATH=/contrato-estetica/
```

As chaves estão em: **Project Settings → API**

## Desenvolvimento local

```bash
npm install
npm run dev
```

- Admin: http://localhost:5173/admin.html
- Contrato de teste: gere um link pelo admin

## Deploy no GitHub Pages

### Secrets do repositório

Em **Settings → Secrets and variables → Actions**, adicione:

| Secret | Valor |
|--------|-------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon (pública) |

### GitHub Pages

**Settings → Pages → Source: GitHub Actions**

A cada push na branch `main`, o site é publicado em:

`https://robinCardoso.github.io/contrato-estetica/`

## Fluxo de uso

1. Profissional acessa `/admin.html` e faz login
2. Preenche plano de tratamento, valor e **assina**
3. Clica em **Gerar link para paciente**
4. Envia o link (WhatsApp, etc.)
5. Paciente preenche dados, tira foto, assina e gera o PDF

## Segurança

- Cada contrato tem um **token aleatório de 48 caracteres** — impossível de adivinhar
- Paciente só acessa o contrato pelo token (via RPC no Supabase)
- Assinatura da profissional fica no banco, não no código público
- Apenas usuários autenticados veem a lista de contratos no admin

## LGPD

Os dados ficam no seu projeto Supabase. Revise políticas de retenção e backup conforme sua clínica.
