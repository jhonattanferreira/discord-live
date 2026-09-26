import asyncio
import logging
from collections import defaultdict

import discord

from discord_live.config import load_config
from discord_live.meet_service import Meeting, MeetError, MeetService, load_credentials

log = logging.getLogger("discord_live")

config = load_config()

intents = discord.Intents.default()
intents.voice_states = True
bot = discord.Client(intents=intents)

meet_service: MeetService | None = None

# voice_channel_id -> Meeting. Só em memória, some ao reiniciar o bot.
active_meetings: dict[int, Meeting] = {}
# Evita criar dois Meets se duas pessoas entrarem ao mesmo tempo
channel_locks: defaultdict[int, asyncio.Lock] = defaultdict(asyncio.Lock)


def is_monitored(channel: discord.abc.GuildChannel) -> bool:
    if not isinstance(channel, discord.VoiceChannel):
        return False
    return not config.voice_channel_ids or channel.id in config.voice_channel_ids


def human_count(channel: discord.VoiceChannel) -> int:
    count = 0
    for user_id in channel.voice_states:
        member = channel.guild.get_member(user_id)
        if member is None or not member.bot:
            count += 1
    return count


async def get_text_channel() -> discord.abc.Messageable | None:
    channel = bot.get_channel(config.text_channel_id)
    if channel is not None:
        return channel
    try:
        return await bot.fetch_channel(config.text_channel_id)
    except discord.NotFound:
        log.error("Canal de texto %s não encontrado", config.text_channel_id)
    except discord.Forbidden:
        log.error("Sem permissão para ver o canal de texto %s", config.text_channel_id)
    except discord.HTTPException as e:
        log.error("Erro ao buscar canal de texto: %s", e)
    return None


async def announce(voice_channel: discord.VoiceChannel, meeting: Meeting) -> None:
    text_channel = await get_text_channel()
    if text_channel is None:
        return
    try:
        await text_channel.send(
            f"📹 Google Meet criado para {voice_channel.mention}\n\n{meeting.meeting_uri}"
        )
    except discord.Forbidden:
        log.error("Sem permissão para enviar mensagens no canal %s", config.text_channel_id)
    except discord.HTTPException as e:
        log.error("Erro ao enviar mensagem no Discord: %s", e)


async def ensure_meeting(voice_channel: discord.VoiceChannel) -> None:
    async with channel_locks[voice_channel.id]:
        if voice_channel.id in active_meetings:
            return
        if human_count(voice_channel) == 0:
            return  # Todo mundo saiu antes de chegarmos aqui

        try:
            meeting = await asyncio.to_thread(meet_service.create_meeting)
        except MeetError as e:
            log.error("%s", e)
            return

        active_meetings[voice_channel.id] = meeting
        log.info("Meet %s criado para #%s", meeting.meeting_uri, voice_channel.name)

    await announce(voice_channel, meeting)


async def release_meeting_if_empty(voice_channel: discord.VoiceChannel) -> None:
    async with channel_locks[voice_channel.id]:
        if human_count(voice_channel) > 0:
            return
        meeting = active_meetings.pop(voice_channel.id, None)
        if meeting:
            log.info("#%s ficou vazio, liberando %s", voice_channel.name, meeting.meeting_uri)


@bot.event
async def on_ready() -> None:
    log.info("Conectado como %s", bot.user)
    if await get_text_channel() is None:
        log.warning("O bot não vai conseguir postar os links até o canal de texto ser corrigido")


@bot.event
async def on_voice_state_update(
    member: discord.Member, before: discord.VoiceState, after: discord.VoiceState
) -> None:
    if member.bot or before.channel == after.channel:
        return  # Ignora bots e mudanças de mute/deafen/stream

    # Saída ou troca de canal: o canal antigo pode ter ficado vazio
    if before.channel is not None and is_monitored(before.channel):
        await release_meeting_if_empty(before.channel)

    # Entrada ou troca de canal: garante um Meet no canal novo
    if after.channel is not None and is_monitored(after.channel):
        await ensure_meeting(after.channel)


def main() -> None:
    global meet_service

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

    # OAuth antes de conectar no Discord: na primeira execução abre o navegador
    credentials = load_credentials(config.google_credentials_file, config.google_token_file)
    meet_service = MeetService(credentials, config.google_token_file)

    bot.run(config.discord_bot_token, log_handler=None)


if __name__ == "__main__":
    main()
