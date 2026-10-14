# -*- coding: utf-8 -*-
"""Repasse de leads e agendamentos para um webhook (n8n, Make, CRM…). Nunca derruba a requisição do visitante."""
from __future__ import annotations

import asyncio
import logging

import httpx

log = logging.getLogger("modelos.webhook")
TENTATIVAS = (0.0, 0.5, 1.5)  # espera antes de cada tentativa, em segundos


async def enviar(url: str, payload: dict) -> bool:
    """Tenta até 3 vezes com espera crescente. Devolve True se algum envio foi aceito (2xx)."""
    if not url:
        return False
    async with httpx.AsyncClient(timeout=5.0) as cli:
        for espera in TENTATIVAS:
            if espera:
                await asyncio.sleep(espera)
            try:
                r = await cli.post(url, json=payload)
                if 200 <= r.status_code < 300:
                    return True
                log.warning("webhook respondeu %s (tentando de novo)", r.status_code)
            except httpx.HTTPError as exc:
                log.warning("webhook falhou: %s (tentando de novo)", exc)
    log.error("webhook: desisti depois de %d tentativas; o registro ficou salvo no banco", len(TENTATIVAS))
    return False
