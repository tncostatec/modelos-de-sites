# -*- coding: utf-8 -*-
"""Configuração por variável de ambiente. Tudo tem padrão seguro para rodar local sem .env."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import time
from pathlib import Path


def _lista(valor: str) -> list[str]:
    return [v.strip() for v in valor.split(",") if v.strip()]


def _hora(valor: str) -> time:
    h, m = valor.split(":")
    return time(int(h), int(m))


@dataclass(frozen=True)
class Config:
    db_path: Path = field(default_factory=lambda: Path(os.environ.get("DB_PATH", "dados/modelos.sqlite3")))
    # Para onde cada lead/agendamento é repassado (ex.: webhook do n8n). Vazio = não repassa.
    webhook_url: str = field(default_factory=lambda: os.environ.get("WEBHOOK_URL", ""))
    # Origens (sites) autorizadas a chamar a API pelo navegador. "*" só para demonstração.
    allowed_origins: list[str] = field(default_factory=lambda: _lista(os.environ.get("ALLOWED_ORIGINS", "*")))
    # Agenda: dias ISO (1 = segunda … 7 = domingo), janela e passo em minutos.
    agenda_dias: list[int] = field(default_factory=lambda: [int(d) for d in _lista(os.environ.get("AGENDA_DIAS", "1,2,3,4,5"))])
    agenda_inicio: time = field(default_factory=lambda: _hora(os.environ.get("AGENDA_INICIO", "09:00")))
    agenda_fim: time = field(default_factory=lambda: _hora(os.environ.get("AGENDA_FIM", "18:00")))
    agenda_passo_min: int = field(default_factory=lambda: int(os.environ.get("AGENDA_PASSO", "30")))
    # Antecedência mínima para agendar hoje, em minutos.
    agenda_antecedencia_min: int = field(default_factory=lambda: int(os.environ.get("AGENDA_ANTECEDENCIA", "60")))
    # Limite de requisições de escrita por IP por hora. 0 desliga (testes).
    rate_limit_hora: int = field(default_factory=lambda: int(os.environ.get("RATE_LIMIT", "30")))
    # Prefixo do protocolo devolvido ao visitante.
    protocolo_prefixo: str = field(default_factory=lambda: os.environ.get("PROTOCOLO_PREFIXO", "MD"))


def carregar() -> Config:
    return Config()
