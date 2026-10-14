# -*- coding: utf-8 -*-
"""Validação de entrada (Pydantic v2). Mensagens em português, porque voltam para o visitante."""
from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

RE_ORIGEM = re.compile(r"^[a-z0-9-]{2,40}$")
RE_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def normalizar_telefone(valor: str) -> str:
    """Guarda só dígitos; aceita (00) 00000-0000, +55 00 0000-0000 etc. Exige 10 ou 11 dígitos (DDD + número)."""
    digitos = re.sub(r"\D", "", valor or "")
    if digitos.startswith("55") and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if len(digitos) not in (10, 11):
        raise ValueError("Informe um telefone com DDD, por exemplo (00) 00000-0000.")
    return digitos


class Base(BaseModel):
    origem: str = Field(..., description="slug do modelo que enviou")
    nome: str = Field(..., min_length=2, max_length=80)
    telefone: str = Field(..., max_length=25)  # o tamanho mínimo é checado no validador, com mensagem própria
    consentimento: bool
    site: str = Field("", max_length=200, description="honeypot: humano não preenche")

    @field_validator("origem")
    @classmethod
    def _origem(cls, v: str) -> str:
        if not RE_ORIGEM.match(v):
            raise ValueError("origem inválida")
        return v

    @field_validator("nome")
    @classmethod
    def _nome(cls, v: str) -> str:
        v = " ".join(v.split())
        if len(v) < 2:
            raise ValueError("Informe seu nome.")
        return v

    @field_validator("telefone")
    @classmethod
    def _telefone(cls, v: str) -> str:
        return normalizar_telefone(v)

    @field_validator("consentimento")
    @classmethod
    def _consentimento(cls, v: bool) -> bool:
        if v is not True:
            raise ValueError("É preciso autorizar o contato para enviar.")
        return v


class LeadEntrada(Base):
    email: str | None = Field(None, max_length=120)
    mensagem: str | None = Field(None, max_length=2000)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        v = v.strip().lower()
        if not RE_EMAIL.match(v):
            raise ValueError("E-mail inválido.")
        return v


class AgendamentoEntrada(Base):
    servico: str = Field(..., min_length=1, max_length=60)
    inicio: str = Field(..., description="AAAA-MM-DDTHH:MM, horário local do negócio")

    @field_validator("inicio")
    @classmethod
    def _inicio(cls, v: str) -> str:
        try:
            dt = datetime.strptime(v[:16], "%Y-%m-%dT%H:%M")
        except ValueError as exc:
            raise ValueError("Horário inválido; use AAAA-MM-DDTHH:MM.") from exc
        return dt.strftime("%Y-%m-%dT%H:%M")


class Protocolo(BaseModel):
    id: int
    protocolo: str


class Slots(BaseModel):
    data: str
    slots: list[str]
    motivo: str | None = None
