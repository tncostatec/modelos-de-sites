# -*- coding: utf-8 -*-
"""Geração de horários livres a partir da janela de atendimento e do que já está marcado."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from .config import Config


def janela(cfg: Config, dia: date) -> list[str]:
    """Todos os 'HH:MM' da janela de atendimento do dia, sem olhar ocupação nem relógio."""
    passo = timedelta(minutes=cfg.agenda_passo_min)
    t = datetime.combine(dia, cfg.agenda_inicio)
    fim = datetime.combine(dia, cfg.agenda_fim)
    out: list[str] = []
    while t + passo <= fim:
        out.append(t.strftime("%H:%M"))
        t += passo
    return out


def slots_do_dia(cfg: Config, dia: date, ocupados: set[str], agora: datetime | None = None) -> tuple[list[str], str | None]:
    """Devolve (lista de 'HH:MM' livres, motivo quando vazia). `agora` é injetável para teste."""
    agora = agora or datetime.now()
    if dia < agora.date():
        return [], "passado"
    if dia.isoweekday() not in cfg.agenda_dias:
        return [], "fechado"
    limite = agora + timedelta(minutes=cfg.agenda_antecedencia_min) if dia == agora.date() else None
    passo = timedelta(minutes=cfg.agenda_passo_min)
    t = datetime.combine(dia, cfg.agenda_inicio)
    fim = datetime.combine(dia, cfg.agenda_fim)
    livres: list[str] = []
    while t + passo <= fim:
        hm = t.strftime("%H:%M")
        if hm not in ocupados and (limite is None or t >= limite):
            livres.append(hm)
        t += passo
    return livres, (None if livres else "lotado")
