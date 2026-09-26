// Faz o login OAuth na conta Google (abre o navegador) e envia client id/secret
// e o refresh token como secrets do Worker. Rode de novo se o token expirar.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const SCOPE = "https://www.googleapis.com/auth/meetings.space.created";

const { installed } = JSON.parse(
  readFileSync(new URL("../credentials.json", import.meta.url), "utf8"),
);
if (!installed) {
  console.error("credentials.json precisa ser de um cliente OAuth do tipo 'App para computador'");
  process.exit(1);
}

// Recebe o redirect do Google numa porta local livre
const server = createServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const redirectUri = `http://127.0.0.1:${server.address().port}`;

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.search = new URLSearchParams({
  client_id: installed.client_id,
  redirect_uri: redirectUri,
  response_type: "code",
  scope: SCOPE,
  // offline + consent garantem que o Google devolva um refresh token
  access_type: "offline",
  prompt: "consent",
}).toString();

console.log(`Abrindo o navegador para login no Google. Se não abrir, acesse:\n\n${authUrl}\n`);
spawn("xdg-open", [authUrl.toString()], { stdio: "ignore", detached: true })
  .on("error", () => {})
  .unref();

const params = await new Promise((resolve) => {
  server.on("request", (req, res) => {
    const params = new URL(req.url, redirectUri).searchParams;
    if (!params.has("code") && !params.has("error")) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(params.has("code") ? "Pronto, pode fechar esta aba e voltar ao terminal." : "Login cancelado.");
    server.close();
    resolve(params);
  });
});
if (!params.has("code")) {
  console.error(`Login não autorizado: ${params.get("error")}`);
  process.exit(1);
}
const code = params.get("code");

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  body: new URLSearchParams({
    code,
    client_id: installed.client_id,
    client_secret: installed.client_secret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  }),
});
const token = await res.json();
if (!res.ok || !token.refresh_token) {
  console.error("Falha ao obter o refresh token:", token);
  process.exit(1);
}

const secrets = {
  GOOGLE_CLIENT_ID: installed.client_id,
  GOOGLE_CLIENT_SECRET: installed.client_secret,
  GOOGLE_REFRESH_TOKEN: token.refresh_token,
};

for (const [name, value] of Object.entries(secrets)) {
  const result = spawnSync("pnpm", ["exec", "wrangler", "secret", "put", name], {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("\nSecrets do Google atualizados no Worker.");
