# -*- coding: utf-8 -*-
"""SQLite com a biblioteca padrão: sem ORM de propósito. Duas tabelas, duas funções de escrita."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo     TEXT NOT NULL UNIQUE,
  origem        TEXT NOT NULL,
  nome          TEXT NOT NULL,
  telefone      TEXT NOT NULL,
  email         TEXT,
  mensagem      TEXT,
  consentimento_em TEXT NOT NULL,
  ip            TEXT,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_origem ON leads (origem, criado_em);

CREATE TABLE IF NOT EXISTS agendamentos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  protocolo     TEXT NOT NULL UNIQUE,
  origem        TEXT NOT NULL,
  nome          TEXT NOT NULL,
  telefone      TEXT NOT NULL,
  servico       TEXT NOT NULL,
  inicio        TEXT NOT NULL UNIQUE,      -- um atendimento por horário: a restrição é a trava contra corrida
  consentimento_em TEXT NOT NULL,
  ip            TEXT,
  criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
"""


def conectar(caminho: Path) -> sqlite3.Connection:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(caminho, check_same_thread=False, isolation_level=None)  # autocommit; transações explícitas
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=3000")
    con.execute("PRAGMA foreign_keys=ON")
    con.executescript(SCHEMA)
    return con


def inserir_lead(con: sqlite3.Connection, **campos) -> int:
    cur = con.execute(
        "INSERT INTO leads (protocolo, origem, nome, telefone, email, mensagem, consentimento_em, ip) "
        "VALUES (:protocolo, :origem, :nome, :telefone, :email, :mensagem, :consentimento_em, :ip)",
        campos,
    )
    return int(cur.lastrowid)


def inserir_agendamento(con: sqlite3.Connection, **campos) -> int:
    """Levanta sqlite3.IntegrityError se o horário já estiver ocupado (UNIQUE em `inicio`)."""
    cur = con.execute(
        "INSERT INTO agendamentos (protocolo, origem, nome, telefone, servico, inicio, consentimento_em, ip) "
        "VALUES (:protocolo, :origem, :nome, :telefone, :servico, :inicio, :consentimento_em, :ip)",
        campos,
    )
    return int(cur.lastrowid)


def horarios_ocupados(con: sqlite3.Connection, dia: str) -> set[str]:
    """Conjunto de 'HH:MM' já agendados no dia 'AAAA-MM-DD'."""
    rows = con.execute("SELECT substr(inicio, 12, 5) AS hm FROM agendamentos WHERE substr(inicio, 1, 10) = ?", (dia,))
    return {r["hm"] for r in rows}
