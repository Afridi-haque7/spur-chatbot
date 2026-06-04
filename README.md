# Spur — AI Live Chat Agent

A mini customer-support chat app: a SvelteKit chat widget talks to a
TypeScript backend that persists every message and calls Groq (Llama) to
generate replies for a fictional store, **Nimbus Goods**.

```
web (SvelteKit)  ──HTTP──>  server (Fastify + TS)  ──>  Groq (Llama)
                                     │
                                     └──> Postgres (Prisma)
```

---

## 1. Prerequisites

- **Node.js 18+** (20+ recommended)
- **PostgreSQL** running locally, or a hosted URL (Neon / Supabase / Render)
- A **Groq API key** (free tier available at console.groq.com)

---

## 2. Run it locally

The repo has two apps: `server/` and `web/`. Run each in its own terminal.

### 2a. Backend

```bash
cd server
npm install

# configure env
cp .env.example .env
#  -> set DATABASE_URL to your Postgres connection string
#  -> set GROQ_API_KEY
#  -> (optional) set GROQ_MODEL to a model you have access to

# create the schema, then (optionally) seed a demo conversation
npx prisma migrate dev --name init
npm run db:seed        # optional

npm run dev            # starts on http://localhost:3001
```

Quick smoke test:

```bash
curl -s http://localhost:3001/health
# {"status":"ok"}

curl -s -X POST http://localhost:3001/chat/message \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is your return policy?"}'
# {"reply":"...","sessionId":"..."}
```

### 2b. Frontend

```bash
cd web
npm install

cp .env.example .env   # PUBLIC_API_BASE_URL defaults to http://localhost:3001

npm run dev            # starts on http://localhost:5173
```

Open <http://localhost:5173> and chat. Reload the page — the conversation
persists (the `sessionId` is stored in `localStorage` and history is re-fetched
from the backend).

---

## 3. Database setup (migrations & seed)

Schema lives in `server/prisma/schema.prisma` (Postgres). Two tables:

- **conversations** — `id`, `channel`, `externalId`, `metadata` (jsonb), timestamps
- **messages** — `id`, `conversationId` (FK, cascade delete), `sender` enum
  (`user`/`ai`/`system`), `text`, `tokenCount`, `createdAt`

Commands (from `server/`):

| Command | What it does |
| --- | --- |
| `npx prisma migrate dev` | Create/apply migrations in dev |
| `npx prisma migrate deploy` | Apply migrations in prod (no prompts) |
| `npm run db:seed` | Insert one demo conversation |
| `npx prisma studio` | Browse the data in a GUI |

> The agent's **domain knowledge** (shipping/returns/hours) is *not* in the DB —
> it lives in `server/src/knowledge/faq.ts` and is injected into the system
> prompt. The seed only demonstrates message persistence.

---

## 4. Environment variables

**server/.env**

| Var | Required | Default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | — | Postgres connection string |
| `GROQ_API_KEY` | ✅ | — | Your Groq key |
| `GROQ_MODEL` | | `llama-3.3-70b-versatile` | Any Groq model (e.g. `llama-3.1-8b-instant` for lower cost) |
| `PORT` | | `3001` | |
| `CORS_ORIGIN` | | `http://localhost:5173` | Comma-separated list of allowed origins |
| `LLM_MAX_TOKENS` | | `512` | Cap on generated tokens per reply |
| `LLM_HISTORY_LIMIT` | | `12` | Past messages sent as context |
| `LLM_TIMEOUT_MS` | | `20000` | Hard timeout for the LLM call |
| `MAX_MESSAGE_LENGTH` | | `4000` | Longer messages are rejected |

**web/.env**

| Var | Default | Notes |
| --- | --- | --- |
| `PUBLIC_API_BASE_URL` | `http://localhost:3001` | Backend URL |

Env is validated at startup (`server/src/config.ts`); missing/invalid values
fail fast with a readable message instead of a confusing runtime crash.
Secrets are never committed — `.env` is gitignored and only `.env.example`
ships.

---

## 5. Architecture overview

### Backend layers (strict separation of concerns)

```
routes/        transport: validate input, call service, serialise output
services/      ChatService — channel-agnostic orchestration (the core)
llm/           LLMProvider interface + Groq implementation + prompt
repositories/  all Prisma/SQL access (conversation, message)
knowledge/     store FAQ data, rendered into the system prompt
lib/           typed errors + zod validation
config.ts      validated env   db.ts  Prisma singleton   app.ts  composition root
```

Request flow for `POST /chat/message`:

1. **Validate** the body (non-empty, length cap, `sessionId` is a UUID if present).
2. **Resolve** the conversation — load by `sessionId`, or create a new one.
3. **Read** the last *N* messages as context (before inserting the new one).
4. **Persist the user message first**, so it survives an LLM failure.
5. **Call the LLM** (system prompt + history + new message) with a timeout.
6. **Persist the AI reply** (with token counts) and bump `updatedAt`.
7. Return `{ reply, sessionId }`.

### Design decisions worth calling out

- **Channel-agnostic core.** `ChatService.handleIncomingMessage({ channel,
  externalId, text })` doesn't know it's being called by a web widget. The
  HTTP route is just one *adapter*; a WhatsApp/Instagram webhook would be
  another adapter calling the same method. The `channel` enum and `externalId`
  column exist now (only `livechat` is wired up) so the seam is visible in the
  schema, not just in prose.
- **LLM behind an interface.** Nothing outside `llm/` imports the Groq
  SDK. Swapping providers or stubbing in a test is a one-file change, and the
  provider is injected into the service via its constructor.
- **One error vocabulary.** Services/LLM throw typed `AppError`s; a single
  Fastify error handler maps them to clean JSON. Internal detail goes to logs;
  only a friendly `userMessage` reaches the client. Unknown errors → generic
  500, never a stack trace.
- **Knowledge as data, not a string.** FAQs are structured so they can later
  move to the DB or a retrieval layer without touching the prompt-building or
  transport code. At this scale, inlining them in the system prompt is the
  correct, boring choice — no vector search needed.

### Frontend

A single `ChatWidget.svelte` (Svelte 5 runes) holds message state, sends on
Enter (Shift+Enter for newline), disables the button while a request is in
flight, shows a typing indicator, auto-scrolls, and renders errors as both an
inline bubble and a dismissible banner. A typed `api.ts` client wraps fetch and
normalises backend/network errors. `sessionId` lives in `localStorage`; on load
the widget fetches history and re-renders it.

---

## 6. LLM notes

- **Provider:** Groq, via `groq-sdk` (OpenAI-compatible chat completions).
  Model is env-configurable (`GROQ_MODEL`), defaulting to
  `llama-3.3-70b-versatile` — a strong, low-cost, low-latency choice for a
  support agent. Because the LLM sits behind the `LLMProvider` interface,
  switching to another provider (e.g. OpenAI or Anthropic) is a single new file
  in `llm/` plus one line in the composition root (`app.ts`).
- **Prompting:** a single system prompt (`llm/prompt.ts`) combines a concise
  persona, the store knowledge (injected from `knowledge/faq.ts`), and
  guardrails — answer only from the provided facts, admit when something is
  unknown and offer a human, never request sensitive credentials, stay on
  topic. The last `LLM_HISTORY_LIMIT` messages are sent as context so replies
  stay coherent across turns.
- **Cost control / guardrails:** `max_tokens` capped (default 512), history
  bounded (default 12 messages), a hard request timeout (default 20s), and
  input length capped server-side (default 4000 chars).
- **Failure handling:** auth / rate-limit / timeout / connection / generic API
  errors are each mapped to a distinct friendly message. The user's message is
  always persisted before the LLM call, so nothing is lost on failure.

---

## 7. Trade-offs & "if I had more time"

**Deliberately left out** (to stay in the timebox; documented rather than
half-built):

- **Streaming responses (SSE).** The single biggest UX upgrade — tokens would
  appear as they're generated instead of after a pause. The provider interface
  is already shaped to allow adding a `streamReply` method without disrupting
  callers.
- **Tests.** I'd add unit tests for `ChatService` (with a stub `LLMProvider`)
  and the validation layer first, then a couple of route-level integration
  tests against a test database.
- **Retrieval over FAQs.** Fine to inline at this scale; for a real catalogue
  I'd move knowledge to the DB and add embeddings-based retrieval, swapping
  only the `knowledge` module.
- **Rate limiting & abuse protection** (per-IP / per-session), and a Redis
  cache for hot FAQ answers.
- **Auth & multi-tenancy**, richer message states (delivered/failed/retry),
  and persisting a flagged `system` error message server-side.

**Known simplifications:**

- `sessionId` is trusted from the client with no ownership check — fine for a
  no-auth demo, not for production.
- Long messages are hard-rejected rather than summarised/truncated; a friendlier
  product might truncate with a notice.

---

## 8. Deployment notes

- **Frontend:** Vercel or Netlify (`@sveltejs/adapter-auto` detects the
  platform). Set `PUBLIC_API_BASE_URL` to the deployed backend URL.
- **Backend:** Render (or any Node host) with a managed Postgres. Build with
  `npm run build`, start with `npm start`, run `npx prisma migrate deploy` on
  release, and set the env vars from section 4. Add the frontend's origin to
  `CORS_ORIGIN`.
