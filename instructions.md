Quero construir um MVP simples de uma integração entre Discord e Google Meet.

## Objetivo

Toda vez que a primeira pessoa entrar em um canal de voz específico do Discord, o bot deve criar automaticamente uma reunião instantânea no Google Meet e enviar o link em um canal de texto do Discord.

Enquanto aquele canal de voz ainda tiver pessoas, o mesmo Meet deve ser reutilizado.

Quando o canal de voz ficar vazio, o Meet associado pode ser removido do estado local, de forma que a próxima entrada crie uma nova reunião.

## Stack

Use Python.

Bibliotecas sugeridas:

- `discord.py`
- Google Meet API
- `google-auth`
- `google-auth-oauthlib`
- client oficial do Google Meet para Python, se fizer sentido

Mantenha o projeto simples. Não quero banco de dados, frontend, Docker, Redis, arquitetura exagerada ou abstrações desnecessárias neste MVP.

## Fluxo esperado

O comportamento deve ser:

```text
usuário entra em um voice channel
        ↓
bot recebe voice state update
        ↓
verifica se o canal já possui um Meet ativo
        ↓
se não possui:
    cria Google Meet
    salva associação:
    discord_voice_channel_id -> meet
        ↓
manda o link no canal de texto

se já possui:
    não cria outro Meet
```

Quando o último usuário sair:

```text
voice channel fica vazio
        ↓
remove associação do Meet daquele canal
```

Na próxima entrada, um novo Meet deve ser criado.

## Google Meet

Não quero criar evento no Google Calendar.

Quero criar diretamente um meeting space instantâneo usando a Google Meet REST API.

Endpoint relevante:

```text
POST https://meet.googleapis.com/v2/spaces
```

Ou o equivalente através do client oficial Python.

O retorno deve fornecer o `meetingUri`, algo como:

```text
https://meet.google.com/abc-defg-hij
```

Esse é o link que deve ser enviado no Discord.

A reunião começa efetivamente quando alguém abrir o link.

## OAuth Google

O bot vai usar apenas UMA conta Google.

Não quero autenticação individual por usuário do Discord.

Na primeira execução, deve haver um fluxo OAuth onde eu autorizo minha conta Google.

Escopo necessário:

```text
https://www.googleapis.com/auth/meetings.space.created
```

Fluxo esperado:

```text
primeira execução
→ abre OAuth do Google
→ eu autorizo
→ recebe access token + refresh token
→ salva localmente

execuções seguintes
→ carrega token salvo
→ renova access token automaticamente quando necessário
```

Pode usar algo semelhante a:

```python
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/meetings.space.created"
]

flow = InstalledAppFlow.from_client_secrets_file(
    "credentials.json",
    SCOPES,
)

credentials = flow.run_local_server(port=0)
```

Depois salvar as credenciais em `token.json`.

`credentials.json` e `token.json` NÃO devem ir para o Git.

Adicione-os ao `.gitignore`.

## Discord

Use `discord.py`.

O evento principal deve ser algo baseado em:

```python
@bot.event
async def on_voice_state_update(member, before, after):
    ...
```

Precisamos distinguir:

- usuário entrando em voice channel
- usuário trocando de voice channel
- usuário saindo
- canal ficando completamente vazio

Não crie um Meet para cada pessoa.

O Meet pertence ao voice channel.

Exemplo de estado em memória:

```python
active_meetings = {
    voice_channel_id: {
        "meeting_uri": "...",
        "space_name": "..."
    }
}
```

Não precisa persistir esse estado entre reinicializações do bot neste MVP.

## Canal de texto

Configure via variável de ambiente o ID do canal de texto onde o bot enviará as reuniões.

Exemplo:

```env
DISCORD_BOT_TOKEN=
DISCORD_TEXT_CHANNEL_ID=
```

Se fizer sentido, também permita configurar quais voice channels são monitorados.

Exemplo:

```env
DISCORD_VOICE_CHANNEL_IDS=123,456
```

Se essa variável não existir, pode monitorar todos os voice channels do servidor.

## Mensagem

Quando um novo Meet for criado, mandar algo simples como:

```text
📹 Google Meet criado para #NomeDoVoiceChannel

https://meet.google.com/abc-defg-hij
```

Pode usar embed se ficar simples, mas não é necessário.

## Estrutura

Quero algo pequeno, legível e organizado.

Pode ser algo como:

```text
src/
    bot.py
    meet_service.py
    config.py

credentials.json
token.json
.env
.gitignore
README.md
```

Não precisa seguir exatamente essa estrutura se houver uma alternativa melhor e ainda simples.

## Tratamento de erros

Tenha tratamento básico para:

- erro ao criar reunião no Google
- token expirado
- token OAuth inválido/revogado
- canal de texto não encontrado
- permissões insuficientes do Discord
- falha de rede

Não quero sistema complexo de retry neste MVP.

Log simples no terminal já é suficiente.

## Requisitos importantes

Não faça overengineering.

Não quero:

- banco
- Redis
- Docker
- Kubernetes
- frontend
- painel administrativo
- comandos slash
- múltiplas contas Google
- múltiplos tenants
- persistência
- sistema complexo de cache
- arquitetura enterprise

Quero primeiro provar que isso funciona.

## Entrega esperada

Antes de escrever código:

1. inspecione o diretório atual
2. veja se já existe algum projeto ou configuração que devemos aproveitar
3. me explique brevemente a implementação que pretende fazer

Depois implemente o MVP.

Também crie um README curto explicando:

1. como criar o bot no Discord Developer Portal
2. quais intents/permissões precisam ser habilitados
3. como convidar o bot para o servidor
4. como criar o projeto no Google Cloud
5. como habilitar Google Meet API
6. como configurar OAuth
7. como gerar `credentials.json`
8. como configurar `.env`
9. como executar o bot
10. como fazer o primeiro login OAuth

Mantenha tudo simples e focado no MVP.
