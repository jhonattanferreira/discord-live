import logging
from dataclasses import dataclass
from pathlib import Path

from google.api_core.exceptions import GoogleAPIError
from google.apps import meet_v2
from google.auth.exceptions import GoogleAuthError, RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/meetings.space.created"]


class MeetError(Exception):
    pass


@dataclass
class Meeting:
    meeting_uri: str
    space_name: str


def load_credentials(credentials_file: str, token_file: str) -> Credentials:
    """Carrega o token salvo; se não existir ou for inválido, abre o fluxo OAuth no navegador."""
    token_path = Path(token_file)
    creds = None

    if token_path.exists():
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)

    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
        except RefreshError:
            log.warning("Refresh token inválido ou revogado, é preciso autorizar de novo")
            creds = None

    if not creds or not creds.valid:
        if not Path(credentials_file).exists():
            raise SystemExit(f"{credentials_file} não encontrado (veja o README)")
        flow = InstalledAppFlow.from_client_secrets_file(credentials_file, SCOPES)
        creds = flow.run_local_server(port=0)

    token_path.write_text(creds.to_json())
    return creds


class MeetService:
    def __init__(self, credentials: Credentials, token_file: str):
        self._credentials = credentials
        self._token_file = Path(token_file)
        # O client renova o access token sozinho usando o refresh token
        self._client = meet_v2.SpacesServiceClient(credentials=credentials)

    def create_meeting(self) -> Meeting:
        """Chamada bloqueante: rode com asyncio.to_thread."""
        try:
            space = self._client.create_space(request=meet_v2.CreateSpaceRequest())
        except RefreshError as e:
            raise MeetError(
                f"Token OAuth inválido/revogado. Apague {self._token_file} e reinicie o bot. ({e})"
            ) from e
        except (GoogleAPIError, GoogleAuthError) as e:
            raise MeetError(f"Falha ao criar reunião no Google Meet: {e}") from e

        # Persiste o access token renovado para a próxima execução
        self._token_file.write_text(self._credentials.to_json())
        return Meeting(meeting_uri=space.meeting_uri, space_name=space.name)
