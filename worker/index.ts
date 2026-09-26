interface Env {
  ASSETS: Fetcher;
  MEETINGS: KVNamespace;
  DISCORD_CLIENT_ID: string;
  // Secrets (wrangler secret put / .dev.vars)
  DISCORD_BOT_TOKEN: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
}

interface Meeting {
  meetingUri: string;
}

const DISCORD_VOICE_CHANNEL = 2;

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

// Garante que o canal é um canal de voz que o bot enxerga, para ninguém
// criar Meets na conta Google com IDs aleatórios
async function assertVoiceChannel(env: Env, channelId: string): Promise<void> {
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
  });
  if (res.status === 403 || res.status === 404) {
    throw new HttpError(404, "Canal não encontrado");
  }
  if (!res.ok) {
    throw new HttpError(502, `Erro ao consultar o Discord (${res.status})`);
  }
  const channel = await res.json<{ type: number }>();
  if (channel.type !== DISCORD_VOICE_CHANNEL) {
    throw new HttpError(400, "Não é um canal de voz");
  }
}

async function googleAccessToken(env: Env): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) {
    // invalid_grant = refresh token expirado ou revogado
    throw new HttpError(502, `Falha ao renovar token do Google: ${await res.text()}`);
  }
  const data = await res.json<{ access_token: string }>();
  return data.access_token;
}

async function createMeeting(env: Env): Promise<Meeting> {
  const token = await googleAccessToken(env);
  const res = await fetch("https://meet.googleapis.com/v2/spaces", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    // OPEN: quem tiver o link entra direto, sem "pedir para participar"
    body: JSON.stringify({ config: { accessType: "OPEN" } }),
  });
  if (!res.ok) {
    throw new HttpError(502, `Falha ao criar reunião no Google Meet: ${await res.text()}`);
  }
  const space = await res.json<{ meetingUri: string }>();
  return { meetingUri: space.meetingUri };
}

async function getMeeting(env: Env, channelId: string | null): Promise<Response> {
  if (!channelId || !/^\d+$/.test(channelId)) {
    throw new HttpError(400, "channel_id inválido");
  }

  const key = `channel:${channelId}`;
  const saved = await env.MEETINGS.get<Meeting>(key, "json");
  if (saved) {
    return json(saved);
  }

  await assertVoiceChannel(env, channelId);
  const meeting = await createMeeting(env);
  await env.MEETINGS.put(key, JSON.stringify(meeting));
  console.log(`Meet ${meeting.meetingUri} criado para o canal ${channelId}`);
  return json(meeting);
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    // Dentro do Discord as requisições passam pelo proxy com o prefixo /.proxy
    const path = url.pathname.replace(/^\/\.proxy(?=\/)/, "");

    try {
      if (path === "/api/config") {
        return json({ clientId: env.DISCORD_CLIENT_ID });
      }
      if (path === "/api/meeting") {
        return await getMeeting(env, url.searchParams.get("channel_id"));
      }
    } catch (e) {
      if (e instanceof HttpError) {
        console.error(e.message);
        return json({ error: e.message }, e.status);
      }
      console.error(e);
      return json({ error: "Erro interno" }, 500);
    }

    url.pathname = path;
    return env.ASSETS.fetch(new Request(url, request));
  },
} satisfies ExportedHandler<Env>;
