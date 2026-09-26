import { DiscordSDK } from "@discord/embedded-app-sdk";

const card = document.querySelector<HTMLElement>(".card")!;
const statusEl = document.getElementById("status")!;
const spinner = document.getElementById("spinner")!;
const codeEl = document.getElementById("code")!;
const button = document.getElementById("open") as HTMLButtonElement;

function showStatus(text: string, state: "loading" | "error" = "loading"): void {
  card.dataset.state = state;
  statusEl.textContent = text;
  spinner.hidden = state !== "loading";
}

function showMeeting(meetingUri: string, note: string, open: () => void): void {
  card.dataset.state = "ready";
  statusEl.textContent = note;
  spinner.hidden = true;
  codeEl.textContent = new URL(meetingUri).pathname.slice(1);
  codeEl.hidden = false;
  button.hidden = false;
  button.addEventListener("click", open);
}

async function api<T>(path: string): Promise<T> {
  // /.proxy/ faz a requisição passar pelo proxy do Discord até o Worker
  const res = await fetch(`/.proxy${path}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

// Aberta direto no navegador (fora do Discord): mostra a tela com um link de exemplo
function preview(): void {
  const meetingUri = "https://meet.google.com/abc-defg-hij";
  showMeeting(meetingUri, "Pré-visualização fora do Discord", () =>
    window.open(meetingUri, "_blank"),
  );
}

async function main(): Promise<void> {
  // O Discord sempre abre a Activity com ?frame_id=…
  if (!new URLSearchParams(location.search).has("frame_id")) {
    preview();
    return;
  }

  const { clientId } = await api<{ clientId: string }>("/api/config");
  const discordSdk = new DiscordSDK(clientId);
  await discordSdk.ready();

  if (!discordSdk.channelId) {
    showStatus("Abra esta Activity dentro de um canal de voz.", "error");
    return;
  }

  showStatus("Buscando o Meet deste canal…");
  const { meetingUri } = await api<{ meetingUri: string }>(
    `/api/meeting?channel_id=${discordSdk.channelId}`,
  );

  showMeeting(meetingUri, "Reunião deste canal de voz", () => {
    discordSdk.commands.openExternalLink({ url: meetingUri });
  });
}

main().catch((e: unknown) => {
  showStatus(`Não foi possível carregar o Meet: ${e instanceof Error ? e.message : e}`, "error");
});
