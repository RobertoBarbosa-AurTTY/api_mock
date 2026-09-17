# Pretreino Mock API

API mock para os desafios de backend do Pretreino, construída com Deno e sem dependências externas. Os dados ficam em memória (seed carregado de `./data` no startup) e não há banco de dados.

- **Base URL (produção):** https://api-mock-98te.onrender.com
- **Documentação interativa (Swagger UI):** https://api-mock-98te.onrender.com/docs#/
- **Spec OpenAPI:** https://api-mock-98te.onrender.com/openapi.json
- **Health check:** https://api-mock-98te.onrender.com/health
- **Raiz:** https://api-mock-98te.onrender.com/ (lista de endpoints e links)

## Autenticação

Todos os endpoints `/api/*` exigem um token de acesso no header `Authorization: Bearer <token>`. Obtenha o token fazendo login com um dos usuários de seed.

| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/auth/login` | Valida e-mail e senha e retorna o token |
| GET | `/api/auth/me` | Retorna o usuário autenticado |
| POST | `/api/auth/logout` | Invalida o token atual |

Credenciais de seed (todas com senha `123456`):

| E-mail | Senha |
| --- | --- |
| `joao@email.com` | `123456` |
| `maria@email.com` | `123456` |
| `pedro@email.com` | `123456` |

```bash
# 1. Login
curl -X POST https://api-mock-98te.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "joao@email.com", "password": "123456"}'

# 2. Usar o token retornado
curl https://api-mock-98te.onrender.com/api/clientes \
  -H "Authorization: Bearer <SEU_TOKEN>"
```

> Rotas públicas (sem token): `GET /`, `GET /health`, `GET /docs`, `GET /swagger` e `GET /openapi.json`.

## Endpoints

Todos sob `/api`, com aliases em português e inglês (`clientes`/`clients`, `usuarios`/`users`, `produtos`/`products`, `metricas`/`metrics`).

### Clientes
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/clientes` | Lista clientes (filtro opcional `?status=ativo\|inativo\|pendente`) |
| GET | `/api/clientes/:id` | Busca cliente por id |
| POST | `/api/clientes` | Cria cliente |
| PUT / PATCH | `/api/clientes/:id` | Atualiza cliente |
| DELETE | `/api/clientes/:id` | Remove cliente |

### Usuários
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/usuarios` | Lista usuários |
| GET | `/api/usuarios/:id` | Busca usuário por id |
| POST | `/api/usuarios` | Cria usuário |
| PUT / PATCH | `/api/usuarios/:id` | Atualiza usuário |
| DELETE | `/api/usuarios/:id` | Remove usuário |

### Produtos
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/produtos` | Lista produtos |
| GET | `/api/produtos/:id` | Busca produto por id |
| POST | `/api/produtos` | Cria produto |
| PUT / PATCH | `/api/produtos/:id` | Atualiza produto |
| DELETE | `/api/produtos/:id` | Remove produto |

### Métricas
| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/metricas` | Lista métricas (filtro opcional `?name=`) |
| POST | `/api/metricas` | Registra métrica |

### E-mails simulados
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/emails` | Simula envio de e-mail e retorna o id gerado |

### Webhooks de pagamento
| Método | Rota | Descrição |
| --- | --- | --- |
| POST | `/api/webhooks` | Recebe evento de pagamento (requer `X-Webhook-Signature`) |

## Exemplos

```bash
# Listar clientes
curl https://api-mock-98te.onrender.com/api/clientes

# Criar produto
curl -X POST https://api-mock-98te.onrender.com/api/produtos \
  -H "Content-Type: application/json" \
  -d '{"name": "Cadeira", "price": 199.90, "stock": 10}'

# Enviar webhook de pagamento
curl -X POST https://api-mock-98te.onrender.com/api/webhooks \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: your_secret_here" \
  -d '{"event": "pagamento.pago", "data": {"paymentId": "pay_123", "orderId": "ord_1", "amount": 99.90, "method": "pix", "date": "2026-09-16"}}'
```

## Simulação de falhas e latência

Útil para testar tratamento de erros no cliente:

- `?delay=2000` — adiciona latência artificial (ms). Também configurável globalmente via `MOCK_DELAY_MS`.
- `?fail=true` — força resposta `500`. Também configurável via `MOCK_FAILURE_RATE` (probabilidade 0..1).

## Variáveis de ambiente

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `PORT` | `8080` | Porta HTTP (definida automaticamente pelo Render) |
| `HOST` | `0.0.0.0` | Endereço de bind |
| `WEBHOOK_SECRET` | `your_secret_here` | Assinatura esperada em `X-Webhook-Signature` |
| `TOKEN_TTL_HOURS` | `24` | Validade do token de autenticação em horas |
| `MOCK_FAILURE_RATE` | `0` | Probabilidade (0..1) de retornar erro `500` simulado |
| `MOCK_DELAY_MS` | `0` | Latência artificial em ms para rotas `/api/*` |

## Rodando localmente

Requer [Deno](https://deno.com/).

```bash
deno task dev    # com watch
deno task start  # produção local
deno task test   # testes
```

## Deploy

- **Docker:** `docker build -t pretreino-mock-api . && docker run -p 8080:8080 pretreino-mock-api`
- **Render:** via Blueprint (`render.yaml`) usando `runtime: docker`, health check em `/health`.