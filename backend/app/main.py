# -*- coding: utf-8 -*-
"""API de apoio aos modelos de site.

Rotas:
  GET  /api/saude                      vida
  POST /api/leads                      contato / orçamento / interesse  → 201 {id, protocolo}
  GET  /api/agenda/slots?data=&servico= horários livres                 → 200 {data, slots, motivo}
  POST /api/agenda                     marcar horário                   → 201 {id, protocolo} | 409 se ocupado

Proteções: honeypot (campo `site`), consentimento obrigatório, limite por IP, CORS restrito por variável.
Repasse opcional por webhook em segundo plano; o banco (SQLite) é a fonte de verdade.
"""
from __future__ import annotations

import logging
import secrets
import sqlite3
import time
from collections import defaultdict, deque
from datetime import date, datetime, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db, webhook
from .agenda import janela, slots_do_dia
from .config import Config, carregar
from .esquemas import AgendamentoEntrada, LeadEntrada, Protocolo, Slots

log = logging.getLogger("modelos.api")


def _protocolo(prefixo: str) -> str:
    return f"{prefixo}-{date.today():%Y%m%d}-{secrets.token_hex(2).upper()}"


def _agora_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


async def _repassar(url: str, payload: dict) -> None:
    """Roda em segundo plano. Qualquer exceção vira log: o visitante já recebeu o protocolo e o banco já gravou."""
    try:
        await webhook.enviar(url, payload)
    except Exception:  # noqa: BLE001 — aqui é o último lugar para segurar
        log.exception("repasse por webhook falhou (registro continua no banco)")


class LimitePorIP:
    """Janela deslizante de 1 h em memória. Suficiente para 1 processo; com vários, trocar por Redis."""

    def __init__(self, por_hora: int):
        self.por_hora = por_hora
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def permitir(self, ip: str) -> bool:
        if self.por_hora <= 0:
            return True
        agora = time.monotonic()
        fila = self._hits[ip]
        while fila and agora - fila[0] > 3600:
            fila.popleft()
        if len(fila) >= self.por_hora:
            return False
        fila.append(agora)
        return True


def criar_app(cfg: Config | None = None) -> FastAPI:
    cfg = cfg or carregar()
    app = FastAPI(title="Modelos de sites · API de apoio", version="1.0.0", docs_url="/api/docs", redoc_url=None)
    app.state.cfg = cfg
    app.state.con = db.conectar(cfg.db_path)
    app.state.limite = LimitePorIP(cfg.rate_limit_hora)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.allowed_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
        max_age=600,
    )

    def con() -> sqlite3.Connection:
        return app.state.con

    def ip_de(req: Request) -> str:
        # Atrás de um proxy reverso confiável, usar o primeiro X-Forwarded-For; aqui o IP direto basta.
        return req.client.host if req.client else "?"

    def checar_limite(req: Request) -> None:
        if not app.state.limite.permitir(ip_de(req)):
            raise HTTPException(429, "Muitas tentativas. Aguarde um pouco e tente de novo.")

    @app.get("/api/saude")
    def saude() -> dict:
        return {"ok": True, "hora": _agora_iso()}

    @app.post("/api/leads", status_code=201, response_model=Protocolo)
    async def criar_lead(entrada: LeadEntrada, req: Request, tarefas: BackgroundTasks,
                         _: None = Depends(checar_limite)) -> Protocolo:
        protocolo = _protocolo(cfg.protocolo_prefixo)
        if entrada.site:
            # Honeypot preenchido: robô. Responde como se tivesse aceitado e não grava nada.
            log.info("honeypot em /api/leads de %s", ip_de(req))
            return Protocolo(id=0, protocolo=protocolo)
        lead_id = db.inserir_lead(
            con(), protocolo=protocolo, origem=entrada.origem, nome=entrada.nome, telefone=entrada.telefone,
            email=entrada.email, mensagem=entrada.mensagem, consentimento_em=_agora_iso(), ip=ip_de(req),
        )
        tarefas.add_task(_repassar, cfg.webhook_url, {
            "tipo": "lead", "protocolo": protocolo, "origem": entrada.origem, "nome": entrada.nome,
            "telefone": entrada.telefone, "email": entrada.email, "mensagem": entrada.mensagem,
        })
        return Protocolo(id=lead_id, protocolo=protocolo)

    @app.get("/api/agenda/slots", response_model=Slots)
    def listar_slots(data: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$"),
                     servico: str = Query("", max_length=60)) -> Slots:
        try:
            dia = date.fromisoformat(data)
        except ValueError:
            raise HTTPException(422, "Data inválida; use AAAA-MM-DD.")
        livres, motivo = slots_do_dia(cfg, dia, db.horarios_ocupados(con(), data))
        return Slots(data=data, slots=livres, motivo=motivo)

    @app.post("/api/agenda", status_code=201, response_model=Protocolo)
    async def agendar(entrada: AgendamentoEntrada, req: Request, tarefas: BackgroundTasks,
                      _: None = Depends(checar_limite)) -> Protocolo:
        protocolo = _protocolo(cfg.protocolo_prefixo)
        if entrada.site:
            log.info("honeypot em /api/agenda de %s", ip_de(req))
            return Protocolo(id=0, protocolo=protocolo)
        dia_txt, hm = entrada.inicio[:10], entrada.inicio[11:16]
        dia = date.fromisoformat(dia_txt)
        livres, motivo = slots_do_dia(cfg, dia, db.horarios_ocupados(con(), dia_txt))
        if hm not in livres:
            # 422 = pedido inválido (dia fechado, passado, fora da janela); 409 = horário válido mas já ocupado.
            valido = motivo in (None, "lotado") and hm in janela(cfg, dia)
            raise HTTPException(409 if valido else 422, "Esse horário não está disponível. Escolha outro.")
        try:
            ag_id = db.inserir_agendamento(
                con(), protocolo=protocolo, origem=entrada.origem, nome=entrada.nome, telefone=entrada.telefone,
                servico=entrada.servico, inicio=entrada.inicio, consentimento_em=_agora_iso(), ip=ip_de(req),
            )
        except sqlite3.IntegrityError:
            # Duas pessoas no mesmo segundo: a restrição UNIQUE decide, não a leitura de antes.
            raise HTTPException(409, "Esse horário acabou de ser ocupado. Escolha outro.")
        tarefas.add_task(_repassar, cfg.webhook_url, {
            "tipo": "agendamento", "protocolo": protocolo, "origem": entrada.origem, "nome": entrada.nome,
            "telefone": entrada.telefone, "servico": entrada.servico, "inicio": entrada.inicio,
        })
        return Protocolo(id=ag_id, protocolo=protocolo)

    @app.exception_handler(HTTPException)
    async def _http(req: Request, exc: HTTPException) -> JSONResponse:
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

    return app


app = criar_app()
