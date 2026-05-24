# Project Haven × Hermes Agent: Real-Time Bushfire Intelligence That Lives on Your Server

*This is a submission for the [Hermes Agent Challenge](https://dev.to/challenges/hermes-agent-2026-05-15): Build With Hermes Agent*

---

## What I Built

**Project Haven** is an AI-powered emergency response platform for bushfire preparedness — evacuation routing, tiered real-time alerts, government recovery grant discovery, and offline-first PWA support for when mobile networks go down mid-crisis.

The platform was originally a 46-hour hackathon build (GovHack 2024 — we won). This year I brought it back from the dead and rebuilt it properly: event-driven microservices, contract-first OpenAPI specs, a prediction engine based on XGBoost weights from our historical bushfire notebooks, and a fully offline-capable React PWA.

The one piece that was always a hollow mock was the **AI Assistant** — the in-app emergency guidance chat. It had a `setTimeout` pretending to think and a big `switch` statement of canned responses. Every time I looked at it I felt embarrassed.

Hermes fixed that.

Hermes Agent is now the live brain behind three things in Project Haven:

1. **In-app emergency guidance** — the AI Assistant page calls Hermes via its OpenAI-compatible `/v1/chat/completions` API, grounded with a system prompt that constrains it to verified Australian emergency protocols and always escalates to 000.

2. **Scheduled fire-risk briefings** — Hermes runs a natural-language cronjob that fires every morning at 6am during fire season, calls the Bureau of Meteorology and NSW RFS feeds, synthesises a risk summary, and publishes it as an event into the alert pipeline.

3. **Recovery grant research** — when a user marks themselves as "in recovery", Hermes autonomously searches for current government grant programs (NDRA, state schemes, Services Australia), compares them against the user's declared situation, and adds matched recommendations to the recommendation service DB.

---

## Demo

> 🎥 *[Video walkthrough — add link here]*

### Screenshots

**AI Assistant — Hermes-powered emergency guidance**

The AI Assistant page now sends messages to Hermes via the api-gateway (`/assistant/v1/chat/completions`). Hermes has persistent memory across sessions via `X-Hermes-Session-Key`, so if a user opened the app two days ago and said "I'm in the Blue Mountains", Hermes still knows that when they say "the fire is getting closer" today.

**Scheduled briefings appearing in the alert feed**

Every morning during fire season, Hermes fetches live fire danger ratings from the NSW RFS API, synthesises a 3-sentence risk summary grounded in real data, and injects it as a `feed.created` event. The event propagates through RabbitMQ to the alert service and appears in-app within seconds.

**Recovery grant matching**

A user marks the "Recovery" scenario. Hermes is asked to research grants available for their postcode and situation. It uses its web search tool to check current Services Australia pages — bypassing the staleness problem of any static dataset — and returns structured results that get persisted back to the recommendations table.

---

## Code

> 🔗 **GitHub Repository:** [project-haven](https://github.com/ujja/project-haven)

### Running it locally

```bash
# Install Hermes Agent
curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
hermes setup   # configure your LLM provider + API key

# Configure Haven
cp .env.example .env
# Set HERMES_API_KEY in .env to your API_SERVER_KEY

# Start everything
docker compose up --build
```

Hermes runs as a sidecar container alongside the six Haven microservices. The api-gateway proxies `/assistant/*` requests to Hermes's OpenAI-compatible server on port 8642.

To trigger the full end-to-end stack:

```bash
# Simulate an extreme weather event near Sydney
curl -X POST http://localhost:8080/weather \
  -H 'Content-Type: application/json' \
  -d '{"lat":-33.87,"lng":151.21,"temperature":42,"windSpeed":80,"humidity":10,"season":"summer","vegetationDensity":0.9}'

# Ask the AI assistant something
curl -X POST http://localhost:8080/assistant/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer your-hermes-key' \
  -H 'X-Hermes-Session-Key: user-abc-session' \
  -d '{"model":"hermes-agent","messages":[{"role":"user","content":"There is a bushfire near me. What do I do right now?"}]}'
```

---

### My Tech Stack

| Layer | Technology |
|---|---|
| **AI backbone** | Hermes Agent v0.14 (OpenAI-compatible API server mode) |
| **Frontend** | React 18, TypeScript, Vite, Workbox PWA, Leaflet |
| **Backend** | Node.js 20, Express, TypeScript — 6 microservices + API gateway |
| **Messaging** | RabbitMQ (event-driven: weather → prediction → alert pipeline) |
| **Databases** | PostgreSQL (per-service) |
| **ML** | XGBoost (Python notebooks → TypeScript heuristic engine) |
| **Data** | Digital Atlas / Geoscience Australia ArcGIS REST APIs |
| **Infra** | Docker Compose, multi-stage builds, shared `@haven/shared` npm package |

---

## How I Used Hermes Agent

### 1. OpenAI-Compatible Sidecar — Zero new API surface

Hermes runs as a Docker Compose service with `API_SERVER_ENABLED=true`. It exposes `POST /v1/chat/completions` exactly like the OpenAI SDK expects. The api-gateway mounts a `/assistant` proxy route pointing at `http://hermes:8642`.

In the React `AIAssistant.tsx`, the `getAIResponse()` function — previously a `setTimeout` + `switch` statement — became a real API call:

```typescript
async function getAIResponse(userMessage: string, sessionKey: string): Promise<string> {
  const res = await fetch('/assistant/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_HERMES_API_KEY}`,
      'X-Hermes-Session-Key': sessionKey,   // persistent memory scope
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages: [
        {
          role: 'system',
          content: HAVEN_SYSTEM_PROMPT,  // emergency protocols, always-call-000, AU context
        },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  const data = await res.json();
  return data.choices[0].message.content;
}
```

Two capabilities made this particularly right for an emergency app:

**Persistent memory via `X-Hermes-Session-Key`** — Hermes's long-term memory means a user who told the app their location and household size two days ago doesn't have to repeat themselves when the crisis actually arrives. That matters. Cognitive load during an emergency is real.

**Opaque tool execution** — Hermes's "opaque mode" (default) means tool calls (web searches, file reads) happen server-side and are invisible to the frontend. The user sees only the final answer. For a crisis UX where every pixel of attention is scarce, this is exactly right. No "I am searching the web…" spinner chains. Just an answer.

---

### 2. Scheduled Fire Risk Briefings — Natural Language Cron

Hermes's cron scheduling is genuinely one of its most underrated features. Instead of writing a Node worker with `node-cron`, a BOM API client, a response parser, and an event publisher, I wrote this in the Hermes config:

```yaml
jobs:
  - name: fire-risk-briefing
    schedule: "0 6 * * * (Oct-Mar)"   # 6am daily, fire season only
    prompt: |
      Check the current fire danger ratings for NSW, VIC, SA, and WA from the
      Bureau of Meteorology and RFS feeds. Synthesise a 3-sentence morning
      briefing — severity level, highest-risk regions, and one action
      recommendation. Keep it under 80 words. Respond with JSON:
      { "severity": "LOW|MEDIUM|HIGH|EXTREME|CATASTROPHIC", "summary": "..." }
    deliver: http://api-gateway:8080/feeds
    skills: [web_search]
```

Hermes handles the scheduling, the web fetch, the summarisation, and the HTTP delivery. The `/feeds` endpoint in the feed service receives the JSON payload and publishes it as a `feed.created` event. The entire pipeline — external data → summary → in-app alert — runs without any new code.

---

### 3. Recovery Grant Research — Delegating Agentic Workloads

The recommendation service seeds static government programs at startup. But government grants change — new schemes open after disasters, eligibility criteria shift, application portals go down and come back up.

For the recovery scenario, I added a route in the api-gateway that delegates a research task to Hermes:

```typescript
// api-gateway: POST /recommendations/research
app.post('/recommendations/research', async (req, res) => {
  const { postcode, situation } = req.body;

  const hermesRes = await fetch('http://hermes:8642/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.HERMES_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'hermes-agent',
      messages: [{
        role: 'user',
        content: `Research current Australian government disaster recovery grants 
          available for postcode ${postcode}. Situation: ${situation}.
          Return JSON array of { title, provider, description, applicationUrl, eligibilitySummary }.
          Only include currently open programs with verified URLs.`,
      }],
    }),
  });

  const data = await hermesRes.json();
  // Parse and upsert into recommendations DB via recommendation-service...
});
```

Hermes uses its web search tool to check current Services Australia, state government, and Red Cross pages. It returns structured JSON. The gateway upserts the results into the recommendation service — live, verified, current — not frozen in a seed file.

The key agentic capability here is **web search grounded in the real prompt**: Hermes doesn't hallucinate grant programs that expired in 2023. It fetches the actual pages, checks them, and only returns what it finds. For emergency advice, that correctness bar is non-negotiable.

---

### Why Hermes Was the Right Fit

A few things made Hermes specifically well-suited here over rolling a custom LLM integration:

**It lives on your server.** Project Haven is explicitly designed for scenarios where internet connectivity is degraded. Hermes runs in the same Docker Compose stack as everything else — no dependency on an external inference API during the crisis window. The model runs locally.

**Persistent memory that scales with the crisis.** Emergency situations evolve over hours and days. A user's context from this morning matters when they're asking questions tonight. Hermes's session memory handles this automatically.

**Scheduled autonomy fits the "prevention not reaction" model.** The best emergency outcome is a user who prepared before the fire arrived. Hermes's cron scheduler lets Project Haven push proactive briefings during fire season without any always-on polling infrastructure.

**OpenAI-compatible API means zero new client code.** The React frontend, the Node gateway, anything that already speaks the OpenAI format works against Hermes unmodified. No new SDK. No vendor lock-in.

---

## Final Thoughts

Project Haven started as a 46-hour hackathon build, sat frozen for two years, and became the platform it was always supposed to be during this rebuild.

The AI Assistant was always the most important feature and the least real. Hermes made it real — not just more capable, but genuinely appropriate for the stakes of an emergency context: server-local, memory-persistent, verifiably grounded, and invisible enough to get out of the way when someone needs an answer fast.

If you're building anything where the AI output actually matters — where a wrong answer has real consequences — the pattern of running Hermes locally with a tight system prompt and opaque tool execution is one I'd recommend seriously.

---

*Built with TypeScript, React, Node.js, PostgreSQL, RabbitMQ, Docker, Hermes Agent, and a lot of respect for the people who actually work bushfire emergencies.*  
*Originally born at GovHack 2024. Finally given room to grow.*
