# Prancheta Pro — Football Manager

Simulador analítico de gestão esportiva e tática de futebol em Português (PT-BR), construído com React, TypeScript, Tailwind CSS e Lucide Icons.

## Estrutura do Projeto

```
├── .github/workflows/
│   └── deploy.yml          # Pipeline automático de build e deploy no GitHub Pages
├── public/
│   ├── .nojekyll           # Evita processamento Jekyll no GitHub Pages
│   └── favicon.svg         # Ícone SVG tático do aplicativo
├── src/
│   ├── components/         # Módulos visuais (Inbox, Elenco, Táticas, Partida 2D, Competições, Finanças)
│   ├── data/               # Base de 20 clubes, elenco de 22 atletas e funções/formações táticas
│   ├── engine/             # Motor matemático 2D, simulação de rodada e testes unitários
│   ├── types/              # Tipagem TypeScript completa
│   ├── utils/              # Formatadores de moeda, datas e indicadores
│   ├── App.tsx             # Shell responsivo (sidebar desktop + barra inferior mobile)
│   └── main.tsx
├── index.html
└── vite.config.ts          # Configurado com base: './' para subcaminhos do GitHub Pages
```

## Desenvolvimento Local

```bash
npm install
npm run dev
```

## Testes e Verificação

```bash
# Verificação de tipos TypeScript
npm run lint

# Testes unitários do motor de partida e liga
npx tsx --test src/engine/matchEngine.test.ts

# Build de produção (gera ./dist)
npm run build
```

## Deploy no GitHub Pages

1. Envie o repositório para o GitHub na branch `main`.
2. No GitHub, acesse **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **GitHub Actions**.
4. O workflow `.github/workflows/deploy.yml` executará automaticamente o lint, os testes unitários, o build (`npm run build`) e publicará o conteúdo de `./dist`.

## Firebase e Segurança de Credenciais no GitHub

- O arquivo `firebase-applet-config.json` é ignorado no `.gitignore` para evitar alertas do **GitHub Secret Scanning / Push Protection**. Utilize `firebase-applet-config.example.json` como referência de estrutura local.
- Sem credenciais configuradas no GitHub, o aplicativo compila e funciona normalmente em **Modo Local** (4 slots de carreira no navegador + exportar/importar backup JSON).
- Para ativar a sincronização em nuvem no GitHub Pages, adicione em **Settings → Secrets and variables → Actions** as variáveis `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` e `VITE_FIREBASE_DATABASE_ID`.

