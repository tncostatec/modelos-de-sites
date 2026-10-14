# Backend de apoio (FastAPI + SQLite)

Uma API pequena que atende os formulários de todos os modelos: contato/orçamento/interesse (`leads`) e
agendamento com horários livres (`agenda`). Grava em SQLite (fonte de verdade) e repassa cada registro a um
webhook (n8n, Make, CRM) em segundo plano, com tentativas. Sem ORM, sem fila, sem framework além do FastAPI:
o objetivo é mostrar um backend de formulário **feito certo**, não um backend grande.

## Rotas

| Método e rota | Para quê | Resposta |
|---|---|---|
| `GET /api/saude` | vida | `200 {ok, hora}` |
| `POST /api/leads` | contato, orçamento, interesse em imóvel | `201 {id, protocolo}` |
| `GET /api/agenda/slots?data=AAAA-MM-DD&servico=` | horários livres do dia | `200 {data, slots: ["09:00", …], motivo}` |
| `POST /api/agenda` | marcar horário | `201 {id, protocolo}` · `409` se o horário acabou de ser ocupado · `422` fora da janela |
| `GET /api/docs` | OpenAPI interativo | |

Corpo do lead: `{origem, nome, telefone, email?, mensagem?, consentimento: true, site: ""}`.
Corpo do agendamento: `{origem, nome, telefone, servico, inicio: "AAAA-MM-DDTHH:MM", consentimento: true, site: ""}`.
`origem` é o slug do modelo que enviou; `site` é o honeypot.

## O que ela protege

- **Honeypot**: `site` preenchido = robô. A API responde `201` com protocolo falso e não grava nada, para não
  ensinar o robô que foi pego.
- **Consentimento LGPD** obrigatório (`consentimento: true`); a hora do consentimento e o IP ficam gravados
  com o registro, que é o que uma auditoria pede.
- **Validação com mensagem em português** ao lado do campo: telefone com DDD (10 ou 11 dígitos, aceita
  qualquer máscara), e-mail opcional, nome com 2+ caracteres.
- **Limite por IP** (janela deslizante de 1 h, em memória): `429` acima de `RATE_LIMIT`. Para vários
  processos ou réplicas, trocar por Redis; está isolado numa classe de 15 linhas para isso.
- **Corrida no agendamento**: a leitura de horários livres é só conveniência; quem decide é a restrição
  `UNIQUE (inicio)` no banco. Duas pessoas no mesmo segundo: uma recebe `201`, a outra `409`.
- **CORS restrito** aos sites listados em `ALLOWED_ORIGINS`.
- **Webhook que não derruba o visitante**: 3 tentativas com espera crescente, em `BackgroundTasks`; se o
  destino estiver fora do ar, o registro continua no banco e o erro vai para o log.

## Rodar

```bash
cd backend
python -m venv .venv && .venv/Scripts/activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload                       # http://127.0.0.1:8000/api/docs
pytest -q                                           # 15 testes, sem rede
```

Com Docker (rootfs somente leitura, `cap_drop: ALL`, `no-new-privileges`, teto de CPU/memória/PIDs):

```bash
docker compose up -d --build
curl -s http://127.0.0.1:8000/api/saude
```

## Ligar um modelo à API

No `config.js` do modelo, `api: "https://api.exemplo.com.br"` (sem barra no fim). Os formulários passam a
enviar para a API e mostram o protocolo; com `api: ""` eles abrem o WhatsApp com a mensagem montada
(é o modo das demonstrações no GitHub Pages).

## O que o webhook recebe

```json
{"tipo": "lead", "protocolo": "MD-20261014-7F3A", "origem": "clinica-odontologica",
 "nome": "Maria Exemplo", "telefone": "00900000000", "email": "maria@exemplo.com.br", "mensagem": "…"}
```

```json
{"tipo": "agendamento", "protocolo": "MD-20261014-1C9E", "origem": "estetica-salao",
 "nome": "Ana Exemplo", "telefone": "00900000000", "servico": "corte", "inicio": "2026-10-20T10:00"}
```

No n8n: um nó Webhook (POST) → IF por `tipo` → WhatsApp/e-mail/CRM.

## Limites conhecidos

- Uma instância, um arquivo SQLite (WAL ligado). Para mais de um processo, o limite por IP precisa de Redis
  e o banco de PostgreSQL; a interface (`db.py`) tem duas funções de escrita e uma de leitura, de propósito.
- Horário local do servidor é o horário do negócio; não há fuso por cliente.
- A agenda tem uma janela única por dia útil; sem feriados nem bloqueios por profissional (o modelo de salão
  mostra a seleção de profissional só na interface).
