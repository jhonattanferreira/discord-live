# discord-live

Activity do Discord que mostra um botão **Abrir Google Meet** dentro do canal de voz. O clique abre no navegador o Meet daquele canal. Roda de graça no Cloudflare Workers, sem máquina ligada.

```
Activity (página em dist/)  →  /api/meeting?channel_id=…  →  Worker
                                                             ├─ KV: canal → Meet já criado
                                                             └─ senão: cria no Google Meet e salva
```

- `index.html` e `src/client.ts`: a página, com o Embedded App SDK do Discord.
- `worker/index.ts`: a API. Confere com o token do bot que o canal é um canal de voz do seu servidor, cria o Meet com acesso aberto (entra sem pedir para participar) e guarda no KV.
- Cada canal de voz tem um link fixo: o Meet é criado na primeira vez e reaproveitado depois.
- `scripts/google-login.mjs`: login OAuth na conta Google, que envia as credenciais como secrets do Worker.

## Pré-requisitos

- [mise](https://mise.jdx.dev/) ativado no shell (`eval "$(mise activate zsh)"` no `~/.zshrc`). Ele instala o Node e o pnpm fixados no `mise.toml`.
- Conta gratuita no [Cloudflare](https://dash.cloudflare.com/sign-up).

```bash
mise install
pnpm install
```

## 1. Aplicação no Discord

1. Em https://discord.com/developers/applications, crie uma aplicação.
2. Na aba **Bot**, gere o token (**Reset Token**). O Worker usa o token para confirmar que o canal existe. O bot não precisa ficar rodando.
3. Em **OAuth2 → URL Generator**, marque `bot` e `applications.commands`, abra a URL e adicione ao servidor. Nenhuma permissão extra é necessária.
4. Em **General Information**, copie o **Application ID** e cole no `wrangler.jsonc` (`DISCORD_CLIENT_ID`).

## 2. Google Cloud

1. Em https://console.cloud.google.com/, crie um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **Google Meet REST API**.
3. Em **Google Auth Platform**:
   - **Branding**: nome do app e e-mail de suporte.
   - **Público-alvo**: *Externo*. Adicione sua conta em **Usuários de teste**, ou publique o app (veja a observação no final).
   - **Acesso a dados**: escopo `https://www.googleapis.com/auth/meetings.space.created`.
   - **Clientes → Criar cliente**: tipo **App para computador**. Baixe o JSON e salve como `credentials.json` na raiz do repo.

## 3. Cloudflare

```bash
pnpm wrangler login
pnpm wrangler kv namespace create MEETINGS   # cole o id no wrangler.jsonc
pnpm run deploy                              # mostra a URL *.workers.dev
```

Use `pnpm run deploy`, não `pnpm deploy` (esse é um comando nativo do pnpm).

## 4. Secrets

Rode num terminal interativo (o wrangler pede o valor):

```bash
pnpm wrangler secret put DISCORD_BOT_TOKEN   # cole o token do bot
pnpm google-login                            # login no Google e envio das credenciais
```

Secrets ficam criptografados no Cloudflare, nunca no repo.

## 5. Habilitar a Activity no Discord

No Developer Portal, na sua aplicação:

1. **Activities → Settings**: ative **Enable Activities** e marque as plataformas (Web, Desktop…).
2. **Activities → URL Mappings**: prefixo `/`, target `<nome-do-worker>.<seu-subdominio>.workers.dev` (sem `https://`).

O Discord cria sozinho o comando `/launch`, que inicia a Activity.

## 6. Usar

1. Entre num canal de voz do servidor.
2. Clique no ícone de **Activities** (🚀) ou digite `/launch` e escolha a aplicação.
3. Clique em **Abrir Google Meet**.

## Desenvolvimento

- `pnpm vite`: abre a página local em modo pré-visualização, com um link de exemplo. Fora do Discord o SDK não conecta.
- `pnpm typecheck`: checa os tipos da página e do Worker.
- `pnpm wrangler tail`: logs do Worker em tempo real.

## Trocar o link de um canal

```bash
pnpm wrangler kv key delete --remote --binding MEETINGS "channel:<ID_DO_CANAL>"
```

O próximo acesso cria um Meet novo.

## Observações

- Com o app OAuth do Google em modo *Teste*, o refresh token expira em 7 dias e a criação de Meets passa a falhar. Publique o app (**Público-alvo → Publicar app**, sem precisar de verificação para uso pessoal) e rode `pnpm google-login` de novo.
- Enquanto o app do Discord não for verificado, pode ser que só você e a equipe do app no Developer Portal consigam abrir a Activity. Confira com outra conta.
