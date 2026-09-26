# discord-live

Bot do Discord que cria um Google Meet quando a primeira pessoa entra num canal de voz e posta o link num canal de texto. Enquanto houver gente no canal, o mesmo Meet é reutilizado. Quando o canal esvazia, a associação é descartada e a próxima entrada cria um Meet novo.

## Requisitos

- [mise](https://mise.jdx.dev/) (instala o Python fixado em `mise.toml`)
- [Poetry](https://python-poetry.org/) 2.x

```bash
mise install
poetry env use "$(mise which python)"
poetry install
```

As dependências ficam em `.venv/` dentro do projeto, nada é instalado no sistema.

## 1. Criar o bot no Discord

1. Acesse https://discord.com/developers/applications e clique em **New Application**.
2. Na aba **Bot**, clique em **Reset Token** e copie o token (vai em `DISCORD_BOT_TOKEN`).

## 2. Intents e permissões

- **Intents:** nenhum intent privilegiado é necessário. O bot usa só os padrões (`guilds` e `voice_states`).
- **Permissões no servidor:** `View Channels` e `Send Messages` no canal de texto onde os links serão postados.

## 3. Convidar o bot

1. Em **OAuth2 → URL Generator**, marque o scope `bot`.
2. Em *Bot Permissions*, marque `View Channels` e `Send Messages`.
3. Abra a URL gerada e escolha o servidor.

Para pegar IDs de canais: *Configurações do usuário → Avançado → Modo desenvolvedor*, depois botão direito no canal → **Copiar ID do canal**.

## 4. Projeto no Google Cloud

1. Acesse https://console.cloud.google.com/ e crie um projeto (ou use um existente).

## 5. Habilitar a Google Meet API

1. **APIs e serviços → Biblioteca**, procure **Google Meet REST API** e clique em **Ativar**.

## 6. Configurar o OAuth

1. **Google Auth Platform → Branding**: preencha nome do app e e-mail de suporte.
2. **Público-alvo**: tipo *Externo* (ou *Interno* se for Workspace) e adicione sua conta Google em **Usuários de teste**.
3. **Acesso a dados**: adicione o escopo `https://www.googleapis.com/auth/meetings.space.created`.

> Com o app em modo *Teste*, o Google expira o refresh token em 7 dias. Para uso contínuo, publique o app (**Público-alvo → Publicar app**). Para um app pessoal não é preciso passar pela verificação, só aceitar o aviso de "app não verificado" no login.

## 7. Gerar o `credentials.json`

1. **Google Auth Platform → Clientes → Criar cliente**.
2. Tipo de aplicativo: **App para computador** (Desktop app).
3. Baixe o JSON e salve na raiz do projeto como `credentials.json`.

## 8. Configurar o `.env`

```bash
cp .env.example .env
```

```env
DISCORD_BOT_TOKEN=seu-token
DISCORD_TEXT_CHANNEL_ID=123456789012345678
# Opcional: só estes canais de voz. Vazio = todos
DISCORD_VOICE_CHANNEL_IDS=111,222
```

`credentials.json`, `token.json` e `.env` estão no `.gitignore`.

## 9. Executar

```bash
poetry run discord-live
```

## 10. Primeiro login OAuth

Na primeira execução (sem `token.json`) o bot abre o navegador para você autorizar sua conta Google. Depois disso o token é salvo em `token.json` e renovado automaticamente.

Se o token for revogado ou expirar de vez, apague o `token.json` e rode de novo para autorizar.

> A primeira execução precisa de um navegador. Para rodar num servidor, faça o login localmente e copie o `token.json` para lá.

## Limitações do MVP

- O estado (canal → Meet) fica só em memória. Se o bot reiniciar com gente no canal, a próxima entrada nesse canal cria um Meet novo.
- O Meet não é encerrado no Google quando o canal esvazia. O bot só esquece o link.
