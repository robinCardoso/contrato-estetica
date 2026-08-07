# GitHub Pages — configuração obrigatória

## O problema

Se o site carregar `./src/js/admin.js` no navegador, o GitHub Pages está publicando o **código-fonte** da branch `main`, não o build do Vite em `dist/`.

Sintoma no console:

```
Failed to resolve module specifier "@supabase/supabase-js"
```

Isso acontece porque `admin.html` na raiz do repositório aponta para módulos ES não empacotados — só funcionam com `npm run dev` (Vite local).

## Como corrigir (escolha UMA opção)

Vá em **Settings → Pages → Build and deployment → Source**:

### Opção A — GitHub Actions (recomendado)

| Campo | Valor |
|-------|-------|
| **Source** | **GitHub Actions** |

O workflow `.github/workflows/deploy.yml` faz `npm run build` e publica o conteúdo de `dist/`.

### Opção B — Branch gh-pages

| Campo | Valor |
|-------|-------|
| **Source** | **Deploy from a branch** |
| **Branch** | `gh-pages` |
| **Folder** | `/ (root)` |

O workflow também atualiza a branch `gh-pages` automaticamente a cada push em `main`.

## O que NÃO usar

| Configuração incorreta | Efeito |
|------------------------|--------|
| Source: **main** / **/ (root)** | Publica HTML sem bundle → login quebrado |
| Source: **main** / **/docs** | Idem |

## Como confirmar que está certo

1. Abra `https://robincardoso.github.io/contrato-estetica/admin.html`
2. **Ver código-fonte** (Ctrl+U)
3. Deve aparecer algo como:

   ```html
   <script type="module" crossorigin src="/contrato-estetica/assets/admin-XXXXX.js"></script>
   ```

4. **Não** deve aparecer `./src/js/admin.js`

## Secrets necessários

**Settings → Secrets and variables → Actions**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Após alterar a Source

1. Vá em **Actions → Deploy GitHub Pages → Run workflow** (ou faça um push em `main`)
2. Aguarde o workflow terminar (build + deploy)
3. Limpe o cache do navegador (Ctrl+Shift+R) e teste novamente
