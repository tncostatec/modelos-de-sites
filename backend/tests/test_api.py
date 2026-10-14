# -*- coding: utf-8 -*-
"""Testes da API: contrato dos formulários, honeypot, agenda com corrida, webhook e limite por IP."""
from __future__ import annotations

import os
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import webhook  # noqa: E402
from app.agenda import slots_do_dia  # noqa: E402
from app.config import Config  # noqa: E402
from app.main import criar_app  # noqa: E402


def proximo_dia_util(a_partir: date | None = None) -> date:
    d = (a_partir or date.today()) + timedelta(days=1)
    while d.isoweekday() > 5:
        d += timedelta(days=1)
    return d


def proximo_domingo() -> date:
    d = date.today() + timedelta(days=1)
    while d.isoweekday() != 7:
        d += timedelta(days=1)
    return d


@pytest.fixture
def cfg(tmp_path: Path) -> Config:
    os.environ["DB_PATH"] = str(tmp_path / "t.sqlite3")
    os.environ["RATE_LIMIT"] = "0"
    os.environ["WEBHOOK_URL"] = "https://webhook.exemplo/teste"
    os.environ["ALLOWED_ORIGINS"] = "https://site.exemplo"
    return Config()


@pytest.fixture
def enviados(monkeypatch) -> list[dict]:
    caixa: list[dict] = []

    async def falso(url: str, payload: dict) -> bool:
        caixa.append({"url": url, **payload})
        return True

    monkeypatch.setattr(webhook, "enviar", falso)
    return caixa


@pytest.fixture
def cli(cfg: Config, enviados) -> TestClient:
    return TestClient(criar_app(cfg))


LEAD = {"origem": "clinica-odontologica", "nome": "Maria Exemplo", "telefone": "(00) 90000-0000",
        "email": "maria@exemplo.com.br", "mensagem": "Quero uma avaliação.", "consentimento": True, "site": ""}


def test_saude(cli):
    r = cli.get("/api/saude")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_lead_valido_grava_e_repassa(cli, enviados):
    r = cli.post("/api/leads", json=LEAD)
    assert r.status_code == 201
    corpo = r.json()
    assert corpo["id"] >= 1 and corpo["protocolo"].startswith("MD-")
    assert len(enviados) == 1 and enviados[0]["tipo"] == "lead" and enviados[0]["telefone"] == "00900000000"
    assert enviados[0]["url"] == "https://webhook.exemplo/teste"


@pytest.mark.parametrize("campo,valor,trecho", [
    ("consentimento", False, "autorizar"),
    ("telefone", "1234", "DDD"),
    ("nome", "A", "nome"),
    ("email", "sem-arroba", "E-mail"),
    ("origem", "Clínica!", "origem"),
])
def test_lead_invalido_422_com_mensagem(cli, campo, valor, trecho):
    r = cli.post("/api/leads", json={**LEAD, campo: valor})
    assert r.status_code == 422
    assert trecho.lower() in r.text.lower()


def test_honeypot_responde_201_mas_nao_grava(cli, enviados):
    r = cli.post("/api/leads", json={**LEAD, "site": "http://spam"})
    assert r.status_code == 201 and r.json()["id"] == 0
    assert enviados == []
    n = cli.app.state.con.execute("SELECT count(*) FROM leads").fetchone()[0]
    assert n == 0


def test_webhook_falhando_nao_derruba_o_lead(cli, monkeypatch):
    async def explode(url, payload):
        raise RuntimeError("fora do ar")

    monkeypatch.setattr(webhook, "enviar", explode)
    r = cli.post("/api/leads", json=LEAD)
    assert r.status_code == 201


def test_slots_dia_util_e_domingo(cli):
    dia = proximo_dia_util()
    r = cli.get("/api/agenda/slots", params={"data": dia.isoformat(), "servico": "limpeza"})
    assert r.status_code == 200
    slots = r.json()["slots"]
    assert slots[0] == "09:00" and slots[-1] == "17:30" and len(slots) == 18
    r = cli.get("/api/agenda/slots", params={"data": proximo_domingo().isoformat()})
    assert r.json()["slots"] == [] and r.json()["motivo"] == "fechado"


def test_slots_hoje_respeita_antecedencia():
    cfg = Config()
    agora = datetime(2026, 10, 14, 10, 10)  # quarta
    livres, _ = slots_do_dia(cfg, agora.date(), set(), agora=agora)
    assert livres[0] == "11:30"  # 10:10 + 60 min = 11:10 → próximo passo de 30 min
    livres, motivo = slots_do_dia(cfg, agora.date() - timedelta(days=1), set(), agora=agora)
    assert livres == [] and motivo == "passado"


def test_agendar_e_corrida_pelo_mesmo_horario(cli, enviados):
    dia = proximo_dia_util()
    corpo = {"origem": "estetica-salao", "nome": "Ana Exemplo", "telefone": "00900000000", "servico": "corte",
             "inicio": f"{dia.isoformat()}T10:00", "consentimento": True, "site": ""}
    r1 = cli.post("/api/agenda", json=corpo)
    assert r1.status_code == 201 and enviados[-1]["tipo"] == "agendamento"
    r2 = cli.post("/api/agenda", json={**corpo, "nome": "Outra Pessoa"})
    assert r2.status_code == 409
    livres = cli.get("/api/agenda/slots", params={"data": dia.isoformat()}).json()["slots"]
    assert "10:00" not in livres and "10:30" in livres


def test_agendar_fora_da_janela_e_formato_invalido(cli):
    dia = proximo_dia_util()
    base = {"origem": "estetica-salao", "nome": "Ana Exemplo", "telefone": "00900000000", "servico": "corte",
            "consentimento": True, "site": ""}
    assert cli.post("/api/agenda", json={**base, "inicio": f"{dia.isoformat()}T20:00"}).status_code == 422
    assert cli.post("/api/agenda", json={**base, "inicio": f"{proximo_domingo().isoformat()}T10:00"}).status_code == 422
    assert cli.post("/api/agenda", json={**base, "inicio": "ontem às dez"}).status_code == 422


def test_limite_por_ip(tmp_path, enviados):
    os.environ["DB_PATH"] = str(tmp_path / "l.sqlite3")
    os.environ["RATE_LIMIT"] = "2"
    c = TestClient(criar_app(Config()))
    assert c.post("/api/leads", json=LEAD).status_code == 201
    assert c.post("/api/leads", json=LEAD).status_code == 201
    r = c.post("/api/leads", json=LEAD)
    assert r.status_code == 429 and "Aguarde" in r.json()["detail"]


def test_cors_restrito(cli):
    r = cli.options("/api/leads", headers={"Origin": "https://site.exemplo", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") == "https://site.exemplo"
    r = cli.options("/api/leads", headers={"Origin": "https://outro.exemplo", "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") is None
