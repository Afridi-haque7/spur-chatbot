# Spur 💬

> AI live-chat support agent — streams personalized, knowledge-grounded answers
> in real time from a channel-agnostic TypeScript backend.

<!-- TODO: replace the Live Demo links with your deployed Vercel (frontend) URL -->
[![Live Demo](https://img.shields.io/badge/Live%20Demo-spur--chat-blue?style=flat-square)](#)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-2-FF3E00?style=flat-square&logo=svelte)](https://kit.svelte.dev)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify)](https://fastify.dev)
[![Groq](https://img.shields.io/badge/Groq-Llama%203.3-F55036?style=flat-square)](https://groq.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## What is Spur?

Spur is a customer-support chat application for a fictional store, **Nimbus
Goods**. Users ask questions in plain language and get streamed, real-time
answers grounded in the store's knowledge base. A SvelteKit chat widget talks to
a TypeScript backend that persists every message and uses Groq (Llama) to
generate replies — with the AI tucked behind a clean provider interface and a
channel-agnostic core that's ready for web, WhatsApp, or any other channel.

---

## ✨ Features

- **Real-time streaming** — replies stream token-by-token over Server-Sent
  Events, rendered with a paced typewriter effect so they read as natural typing,
  not a sudden dump.
- **Channel-agnostic core** — the orchestration layer doesn't know it's serving a
  web widget; a WhatsApp/Instagram webhook would be just another adapter.
- **Pluggable LLM** — the provider sits behind an interface; swapping Groq for
  OpenAI/Anthropic is a one-file change.
- **Durable conversations** — every message is persisted; reloads restore full
  history from the backend.
- **Knowledge-grounded answers** — store FAQs are injected into the system prompt
  with guardrails (answer only from facts, admit unknowns, stay on topic).
- **Fail-fast & safe** — env is validated at startup, and a single typed-error
  vocabulary maps failures to friendly messages — never a leaked stack trace.

---

## 🏗️ Architecture

```
                        ┌──────────────────────────────────────────┐
   User                 │              server (Fastify)            │
    │                   │                                          │
    ▼                   │  routes/      validate · serialise · SSE │
┌─────────────┐  HTTP   │      │                                   │
│   web        │ ───────▶      ▼                                   │       ┌────────────┐
│ (SvelteKit   │   SSE   │  services/   ChatService (core)         │ ────▶ │   Groq     │
│  ChatWidget) │ ◀═══════│      │                                   │       │  (Llama)   │
└─────────────┘ tokens  │      ▼                                   │       └────────────┘
                        │  llm/        LLMProvider + Groq + prompt │
                        │      │                                   │
                        │      ▼                                   │       ┌────────────┐
                        │  repositories/  Prisma data access       │ ────▶ │  Postgres  │
                        └──────────────────────────────────────────┘       └────────────┘
```

Both chat endpoints share the same orchestration and persistence; they differ
only in how the reply is returned (JSON vs. a stream).

```
1. Validate    body (non-empty, length cap, sessionId is a UUID if present)
2. Resolve     conversation — load by sessionId, or create a new one
3. Read        the last N messages as context (before inserting the new one)
4. Persist     the user message first, so it survives an LLM failure
5. Generate    system prompt + history + new message, with a timeout
6. Persist     the AI reply and bump updatedAt
7. Return      JSON (/chat/message) or stream tokens (/chat/message/stream)
```

---

## 🛠️ Tech Stack

**Frontend**
- SvelteKit 2 (Svelte 5 runes)
- TypeScript
- Vite
- Server-Sent Events client (streaming)

**Backend**
- Node.js + Fastify 5
- TypeScript
- Prisma ORM
- Zod (schema validation)

**AI**
- Groq — Llama 3.3 70B (OpenAI-compatible chat completions)
- Provider-agnostic `LLMProvider` interface
- Token streaming over SSE

**Infrastructure**
- Vercel (frontend)
- Render (backend)
- PostgreSQL — Neon / Supabase / Render

---

## 🔧 Getting Started

The repository contains two applications, `server/` and `web/`. Run each in its
own terminal.

### Prerequisites

- Node.js 18+ (20 recommended)
- A PostgreSQL connection string (local, or Neon / Supabase / Render)
- A Groq API key — free tier at [console.groq.com](https://console.groq.com)

### Installation

```bash
# Clone the repo
git clone https://github.com/Afridi-haque7/spur-chatbot.git
cd spur-chatbot
```

### Backend

```bash
cd server
npm install

cp .env.example .env        # then fill in the values below

npx prisma migrate dev --name init   # create the schema
npm run db:seed                      # optional: one demo conversation

npm run dev                 # http://localhost:3001
```

**server/.env**

```env
DATABASE_URL="postgresql://user:pass@host:5432/spur?schema=public"
GROQ_API_KEY=your_groq_key
GROQ_MODEL=llama-3.3-70b-versatile   # or llama-3.1-8b-instant for lower cost
PORT=3001
CORS_ORIGIN=http://localhost:5173    # comma-separated list of allowed origins
LLM_MAX_TOKENS=512                   # cap on generated tokens per reply
LLM_HISTORY_LIMIT=12                 # past messages sent as context
LLM_TIMEOUT_MS=20000                 # hard timeout for the LLM call
MAX_MESSAGE_LENGTH=4000              # longer messages are rejected
```

### Frontend

```bash
cd web
npm install

cp .env.example .env        # PUBLIC_API_BASE_URL defaults to http://localhost:3001

npm run dev                 # http://localhost:5173
```

**web/.env**

```env
PUBLIC_API_BASE_URL=http://localhost:3001   # baked in at build time
```

Open [http://localhost:5173](http://localhost:5173) and start chatting. Replies
stream in live; reload the page and the conversation persists.

---

## 📁 Project Structure

```
├── web/                      # SvelteKit frontend
│   └── src/
│       ├── lib/
│       │   ├── api.ts            # typed API client (SSE streaming)
│       │   ├── types.ts
│       │   └── components/       # ChatWidget, MessageBubble, TypingIndicator
│       └── routes/               # +page.svelte, +layout.svelte
│
└── server/                   # Fastify backend
    ├── prisma/                   # schema.prisma + seed
    └── src/
        ├── routes/               # HTTP transport (chat, health)
        ├── services/             # ChatService — channel-agnostic core
        ├── llm/                  # LLMProvider interface + Groq + prompt
        ├── repositories/         # all Prisma/SQL access
        ├── knowledge/            # FAQ data, injected into the prompt
        ├── lib/                  # typed errors + zod validation
        ├── config.ts             # validated env (fail-fast)
        ├── db.ts                 # Prisma singleton
        └── app.ts                # composition root (dependency wiring)
```

---

## 🔌 API & Streaming

| Method & path | Description |
|---|---|
| `GET /health` | Liveness probe → `{ status: "ok" }` |
| `POST /chat/message` | Synchronous reply → `{ reply, sessionId }` |
| `POST /chat/message/stream` | Streamed reply via Server-Sent Events |
| `GET /chat/:sessionId/history` | Full message history → `{ sessionId, messages }` |

The streaming endpoint sends the session id immediately, then the reply in
chunks, then a terminal event:

| Event | Data | When |
|---|---|---|
| `meta` | `{ sessionId }` | Once, first — before any token |
| `delta` | `{ text }` | Repeated — the next chunk of the reply |
| `done` | `{ messageId, sessionId }` | Once, last — reply generated and persisted |
| `error` | `{ error, message }` | Replaces `done` if generation fails mid-stream |

Because `meta` is sent before generation, a mid-stream failure still leaves the
client with a usable `sessionId`, and the user's message stays persisted.

```bash
# watch tokens arrive as Server-Sent Events
curl -N -X POST http://localhost:3001/chat/message/stream \
  -H 'Content-Type: application/json' \
  -d '{"message":"What are your shipping options?"}'
```

---

## 🤖 How the AI works

A single support agent, kept deliberately simple and behind a clean seam:

1. **Provider interface** — nothing outside `llm/` imports the Groq SDK. The
   provider is injected into `ChatService`, so swapping models or stubbing it in
   a test is a one-file change. It exposes both `generateReply` and
   `generateReplyStream`.
2. **Prompt** — one system prompt combines a concise persona, the store
   knowledge (from `knowledge/faq.ts`), and guardrails: answer only from the
   provided facts, admit unknowns and offer a human, never request sensitive
   credentials, stay on topic.
3. **Context** — the last `LLM_HISTORY_LIMIT` messages are sent so replies stay
   coherent across turns.
4. **Streaming** — the reply is generated incrementally and relayed over SSE; the
   client buffers bursty tokens and reveals them at a steady typewriter pace.
5. **Guardrails** — `max_tokens`, bounded history, a hard request timeout, and a
   server-side input-length cap keep cost and latency in check. Auth, rate-limit,
   timeout, connection, and generic API errors each map to a distinct friendly
   message.

---

## ☁️ Deployment

The two applications deploy independently.

**Frontend → Vercel** (`@sveltejs/adapter-auto` detects the platform)
- Root Directory: `web`
- Set `PUBLIC_API_BASE_URL` to the deployed backend URL (baked in at build time).
- Build is pinned to **Node 20** (`engines` in `web/package.json`).

**Backend → Render** (or any Node host) with a managed Postgres
- Root Directory: `server`
- Build: `npm install && npx prisma generate && npm run build`
- Start: `npm start`
- Apply migrations on release: `npx prisma migrate deploy`
- Set the env vars above, and add the frontend's origin to `CORS_ORIGIN`.
- The stream route sets `Cache-Control: no-transform` and `X-Accel-Buffering: no`
  so proxies flush events live instead of buffering the whole reply.

---

## 🧭 Roadmap

- **Automated tests** — unit tests for `ChatService` (with a stub provider) and
  validation, plus route-level integration tests including the SSE stream.
- **Retrieval over FAQs** — move knowledge to the database with embeddings-based
  retrieval, swapping only the `knowledge` module.
- **Rate limiting & abuse protection** (per-IP / per-session) and a cache for hot
  answers.
- **Auth & multi-tenancy**, richer message states (delivered / failed / retry).

**Known simplifications**
- `sessionId` is trusted from the client with no ownership check (fine for a
  no-auth demo).
- Streamed replies are persisted without token accounting — the pinned
  `groq-sdk` doesn't expose usage on stream chunks; the synchronous endpoint
  records token counts.

---

## 👤 Author

**Afridi Haque**

- Portfolio: [afridih.in](https://afridih.in)
- LinkedIn: [linkedin.com/in/afridi-haque-851924203](https://www.linkedin.com/in/afridi-haque-851924203/)
- GitHub: [@Afridi-haque7](https://github.com/Afridi-haque7)

---

## 📄 License

MIT © Afridi Haque
