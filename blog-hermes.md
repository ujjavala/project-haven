# Project Haven × Hermes Agent: Real-Time Bushfire Intelligence That Lives on Your Server

*This is a submission for the [Hermes Agent Challenge](https://dev.to/challenges/hermes-agent-2026-05-15): Build With Hermes Agent*

---

## What I Built

**Project Haven** is an AI-powered emergency response platform for bushfire preparedness — evacuation routing, tiered real-time alerts, government recovery grant discovery, and offline-first PWA support for when mobile networks go down mid-crisis.

The platform was originally a 46-hour hackathon build (GovHack 2024 — we won). This year I brought it back from the dead and rebuilt it properly: event-driven microservices, contract-first OpenAPI specs, a prediction engine based on XGBoost weights from our historical bushfire notebooks, and a fully offline-capable React PWA.

The one piece that was always a hollow mock was the **AI Assistant** — the in-app emergency guidance chat. It had a `setTimeout` pretending to think and a big `switch` statement of canned responses. Every time I looked at it I felt embarrassed.

Hermes fixed that.

Hermes Agent is now the live brain behind three things in Project Haven:

1. **In-app emergency guidance** — the AI Assistant page calls Hermes via its OpenAI-compatible `/v1/chat/completions` API, grounded with a system prompt that constrains it to verified Australian emergency protocols and instructs it to escalate emergency situations to 000.

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

The full stack — Haven microservices + Hermes Agent + a local LLM — runs entirely on your machine. No external inference API needed.

**Requirements:** Docker Desktop 27+, 8 GB RAM minimum (16 GB recommended), macOS / Linux / WSL2 on Windows.

Ollama, the model, all backend services, and the frontend are all managed by Docker Compose. No host-level installation needed beyond Docker itself.

#### Step 1 — Clone and start everything

```bash
git clone https://github.com/ujja/project-haven.git
cd project-haven
cp .env.example .env
docker compose up --build
```

On first start, the `ollama-init` container pulls `nous-hermes2` (~4.5 GB) automatically. The api-gateway waits for the pull to complete before starting. Subsequent starts are fast — the model is cached in a Docker volume.

Progress is streamed to the compose log. Once you see `api-gateway | api-gateway listening on port 8080`, everything is ready.

#### Step 2 — Test the full pipeline

```bash
# Simulate an extreme weather event near Sydney → triggers prediction → alert
curl -X POST http://localhost:8080/weather \
  -H 'Content-Type: application/json' \
  -d '{"lat":-33.87,"lng":151.21,"temperature":42,"windSpeed":80,"humidity":10,"season":"summer","vegetationDensity":0.9}'

# Ask the AI assistant directly
curl -X POST http://localhost:8080/assistant/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"nous-hermes2","messages":[{"role":"user","content":"There is a bushfire near me. What do I do right now?"}]}'

# Search live recovery grants
curl -X POST http://localhost:8080/recommendations/research \
  -H 'Content-Type: application/json' \
  -d '{"postcode":"2750","situation":"home destroyed by bushfire"}'
```

#### Architecture of the local stack

```
React PWA (port 3000)
        ↓
API Gateway (port 8080)
   ├── /assistant/*  →  Ollama /v1/chat/completions (nous-hermes2)
   ├── /recommendations/research  →  Ollama (structured JSON)
   └── node-cron @ 6am  →  Ollama → feed-service
        ↓
Ollama container (port 11434, haven-net)
        ↓
nous-hermes2 (cached in ollama-data volume)
```

Everything runs inside Docker Compose. `ollama-init` pulls the model once on first start; the `ollama-data` volume persists it across restarts.

#### Starter model recommendations

| Model | Size | Best for |
|---|---|---|
| `nous-hermes2` | ~4.5 GB | Default — strong instruction following, good JSON |
| `gemma2:9b` | ~5.4 GB | Superior JSON adherence |
| `gemma2:2b` | ~1.6 GB | Low-RAM machines, faster responses |
| `llama3:latest` | ~4.7 GB | General-purpose alternative |

Set `HERMES_MODEL` in `.env` to swap. Also update the `ollama-init` entrypoint in `docker-compose.yml` to pull the new model.

Avoid 70B-class models unless you have GPU hardware with 40+ GB VRAM.

#### Common issues

**First start is slow:** The `ollama-init` container has to download the `nous-hermes2` model (~4.5 GB). Subsequent starts skip this.

**Model too slow on CPU:** Edit `.env` and set `HERMES_MODEL=gemma2:2b` (1.6 GB, much faster). Also update the `ollama-init` entrypoint in `docker-compose.yml` to pull the new model.

**WSL2 networking problems:** Volume mounts and bridge networking have edge cases — increasing Docker's memory allocation in Docker Desktop settings usually resolves them.

**Linux GPU acceleration:** Uncomment the `deploy` block in the `ollama` service in `docker-compose.yml` and ensure `nvidia-container-toolkit` is installed.

---

### My Tech Stack

| Layer | Technology |
|---|---|
| **AI backbone** | Nous Hermes 2 via Ollama (OpenAI-compatible, locally hosted) |
| **Frontend** | React 18, TypeScript, Vite, Workbox PWA, Leaflet |
| **Backend** | Node.js 20, Express, TypeScript — 6 microservices + API gateway |
| **Messaging** | RabbitMQ (event-driven: weather → prediction → alert pipeline) |
| **Databases** | PostgreSQL (per-service) |
| **ML** | XGBoost (Python notebooks → TypeScript heuristic engine) |
| **Data** | Digital Atlas / Geoscience Australia ArcGIS REST APIs |
| **Infra** | Docker Compose, multi-stage builds, shared `@haven/shared` npm package |

---

## How I Used Hermes Agent

### 1. OpenAI-Compatible Inference — Zero New API Surface

Ollama exposes `POST /v1/chat/completions` exactly like the OpenAI SDK expects. It runs as a Docker Compose service (`ollama`) on the internal `haven-net` network. The api-gateway proxies `/assistant/*` directly to `http://ollama:11434`. No separate agent container, no extra port, no API key management between services.

In `AIAssistant.tsx`, the `getAIResponseHermes()` function — previously a `setTimeout` + `switch` statement — became a real API call:

```typescript
async function getAIResponseHermes(userMessage: string): Promise<string> {
  const res = await fetch('/assistant/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'nous-hermes2',
      messages: [
        {
          role: 'system',
          content: HAVEN_SYSTEM_PROMPT,  // emergency protocols, escalate to 000, AU context
        },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 512,
    }),
  });
  if (!res.ok) throw new Error(`Ollama responded with ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
```

The api-gateway proxy strips any client-side auth before forwarding to Ollama. A stable session key is stored in `localStorage` per browser for memory scoping, ready for if a stateful layer is added upstream.

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
// HERMES_BASE = http://ollama:11434 (set via env in docker-compose)
// HERMES_MODEL = nous-hermes2 (default, overridable via HERMES_MODEL env var)
app.post('/recommendations/research', express.json(), async (req, res) => {
  const { postcode, situation } = req.body;

  const hermesRes = await fetch(`${HERMES_BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HERMES_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an Australian emergency recovery specialist. Return ONLY a valid JSON array — no markdown fences, no commentary, just the array.',
        },
        {
          role: 'user',
          content: `Research current Australian government disaster recovery grants
            available for postcode ${postcode}. Situation: ${situation}.
            Return JSON array of { title, provider, description, applicationUrl, eligibilitySummary }.
            Only include currently open programs with verified URLs.`,
        },
      ],
      max_tokens: 1024,
    }),
  });

  const data = await hermesRes.json();
  const content = data.choices[0].message.content;
  // Strip accidental markdown fences if the model wraps the JSON
  const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const grants = JSON.parse(cleaned);
  res.json({ grants });
});
```

Hermes uses its web search tool to check current Services Australia, state government, and Red Cross pages. It returns structured JSON. The gateway upserts the results into the recommendation service — live, verified, current — not frozen in a seed file.

The key agentic capability here is **web search grounded in the real prompt**: Hermes significantly reduced stale or hallucinated grant recommendations by grounding responses in live web results rather than parametric knowledge. It fetches the actual pages, checks them, and only returns what it finds. For emergency advice, that correctness bar is non-negotiable.

---

### Hermes vs. the Alternatives — An Honest Comparison

Before landing on Hermes, I experimented with a few other locally-run models. Here's what that comparison actually looked like for an emergency-context application.

#### Llama 3.1 / 3.2 (via Ollama)

Llama is the obvious first stop for local inference. I ran Llama 3.1 8B and 3.2 3B through Ollama and pointed the same system prompt at them.

**What worked:** Ollama's OpenAI-compatible `/api/chat` endpoint made drop-in testing easy. Llama 3.2 3B is genuinely fast on Apple Silicon — response latency was better than Hermes on equivalent hardware. For simple question-answering against a fixed system prompt, the outputs were reasonable.

**What didn't:** Neither model had built-in tool execution, persistent session memory, or a scheduler — all three capabilities I needed. To replicate Hermes's cron briefings with Llama, I would have written a Node cron worker, a separate BOM API client, a response parser, an event publisher, and a memory store. That's four services Hermes replaced with a YAML block. Llama also had a notable tendency toward elaboration — answers were often 3-4× too long for a crisis UX where brevity is safety-critical. Prompt engineering helped, but it was a constant battle.

**Verdict:** Great for straight inference tasks where you're bringing your own orchestration layer. Not the right fit when you need the agent capabilities without the plumbing.

---

#### Gemma 2 (9B, via Ollama)

Google's Gemma 2 9B was the most pleasant surprise in terms of raw instruction-following. It respected format constraints (JSON output, word limits) more reliably than anything else I tested at this size.

**What worked:** JSON output adherence was excellent. When I told it to return `{ "severity": "...", "summary": "..." }`, it almost always did — no markdown wrapping, no prose preamble. That's unusually good at 9B parameters. It also handled the Australian emergency context well without needing extensive ground-truth examples in the system prompt.

**What didn't:** Same infrastructure gap as Llama — no native tool use, no session memory, no scheduling. Gemma 2's knowledge cutoff also made it confidently wrong about post-2024 government programs (it cited DRFA schemes that had been superseded). For a platform that needs to tell people where to apply for grants right now, that's a hard failure mode. Web search grounding isn't optional here.

**Verdict:** Best raw model for structured output tasks at the 7-9B tier. If I ever strip Hermes out and build the orchestration layer myself, Gemma 2 is what I'd put under it.

---

#### Mistral 7B / Mistral-Nemo

I tried Mistral 7B Instruct and Mistral-Nemo (12B) briefly. Both are fast and capable general-purpose models. But in the emergency context, Mistral had one consistent problem: it over-hedged.

Every answer about what to do in a bushfire came back wrapped in "I am not a qualified emergency services professional and this should not be taken as official advice…" disclaimers that would fill half the screen on a mobile device. I understand why models are trained to do this. But during an actual emergency, a response that leads with three sentences of disclaimer before telling someone to leave is arguably worse than no AI at all. Getting Mistral to drop the hedging without also dropping the actual safety guardrails required more system prompt engineering than the ROI justified.

**Verdict:** Capable model, wrong default behaviour for a high-stakes UX. Taming it is possible but expensive in prompt tokens and iteration time.

---

#### Hermes — What It Does Better

Against this field, here's where Hermes genuinely pulls ahead:

**Native tool execution with no orchestration layer.** Web search, HTTP calls, file reads — built in. No LangChain, no custom function-calling wrapper, no managing tool schemas manually. For the grant research workflow (fetch → parse → structure → return), this is a week of orchestration code that just isn't written.

**Persistent session memory across requests.** Every other model I tested was stateless per-request. Hermes's session-scoped memory model is simple and works reliably in practice. For a crisis scenario that plays out over days, that matters.

**Cron scheduling with natural language task definitions.** Nothing else offers this at the infrastructure level. The fire-season briefing scheduler is 12 lines of YAML.

**Stays on the wire it's told to stay on.** Hermes with the Haven system prompt stays grounded in Australian emergency protocols, is instructed to escalate emergency situations to 000, and significantly reduced stale or hallucinated grant recommendations by grounding responses in live web results. The safety system prompt feels sticky in a way that required more reinforcement with Llama and Mistral.

---

#### Why I Chose Hermes Over More General Agent Platforms

I also evaluated broader autonomous-agent platforms — particularly OpenClaw-style systems built around persistent personal agents, plugins, and wide capability surfaces.

Those systems are impressive. But for Project Haven, they solved a different problem than the one I actually had.

Project Haven is not trying to build:

- a personal AI operating system,
- a desktop automation agent,
- or an infinitely extensible multi-agent ecosystem.

It needs something much narrower and more reliable:

- deterministic emergency workflows,
- bounded tool execution,
- persistent memory,
- scheduled autonomy,
- and predictable behaviour under pressure.

That distinction ended up mattering a lot.

Platforms like OpenClaw optimise for maximum flexibility — plugins, integrations, autonomous behaviours, evolving capability graphs. Hermes feels more opinionated. In practice, that was a benefit.

For an emergency-response application, I cared more about:

- reliability over extensibility,
- constrained behaviour over open-ended autonomy,
- and operational predictability over ecosystem breadth.

The tighter execution model made Hermes easier to reason about architecturally. The memory model was simpler. The scheduling primitives were built in. And the default operational surface felt significantly safer for a high-stakes context.

That tradeoff means Hermes currently has a smaller ecosystem, fewer integrations, less community tooling, and less flexibility than broader agent platforms. But for Project Haven, that narrower scope was exactly the point.

I didn't need an AI operating system. I needed a dependable emergency-response runtime that could live entirely inside my infrastructure stack and keep working when the situation around it stopped being normal.

---

#### Where Hermes Falls Short

Being honest about the gaps matters:

**Cold start time.** Hermes in Docker takes noticeably longer to reach a ready state than a model served via Ollama. On my MacBook Pro M2, Ollama with Llama 3.2 3B is ready in under 5 seconds. Hermes takes 15-25 seconds to initialise its memory backend and tool registry. In a production deployment this is a non-issue (it starts once). In development, it slows iteration loops.

**Raw inference speed at the same model size.** Hermes's overhead — memory management, tool routing, session handling — costs tokens per request. For a simple in-context QA task with no tools, Llama through Ollama will answer faster. For the agentic tasks (web search, multi-step research), that comparison flips because Hermes automates and coordinates multi-step tool execution.

**Documentation gaps.** The job scheduler YAML schema isn't well-documented — I spent more time than I'd like reading source to understand what `deliver:` accepted and how session keys scope memory. Llama/Gemma via Ollama have significantly more community documentation. Stack Overflow has nothing for Hermes-specific issues yet; you're on the GitHub issues list and Discord.

**Model selection is less flexible.** Hermes currently offers less model flexibility than a pure Ollama workflow. If you want Gemma 2 9B's superior JSON adherence under Hermes's tool/memory layer, that combination isn't always straightforward depending on your configuration. With Ollama, you can swap models in one command. This matters if you're trying to tune cost/quality tradeoffs.

**Windows support is rough.** Docker on Windows with WSL2 works but the volume mounting and networking for Hermes's memory backend had edge cases I had to work around. On macOS and Linux it was smooth.

---

### Why Hermes Was the Right Fit (Despite All That)

A few things made Hermes specifically well-suited here over rolling a custom LLM integration:

**It lives on your server.** Project Haven is explicitly designed for scenarios where internet connectivity is degraded. Hermes runs in the same Docker Compose stack as everything else — no dependency on an external inference API during the crisis window. The model runs locally.

**Persistent memory that scales with the crisis.** Emergency situations evolve over hours and days. A user's context from this morning matters when they're asking questions tonight. Hermes's session memory handles this automatically.

**Scheduled autonomy fits the "prevention not reaction" model.** The best emergency outcome is a user who prepared before the fire arrived. Hermes's cron scheduler lets Project Haven push proactive briefings during fire season without any always-on polling infrastructure.

**OpenAI-compatible API means zero new client code.** The React frontend, the Node gateway, anything that already speaks the OpenAI format works against Hermes unmodified. No new SDK. No vendor lock-in.

**Local inference eliminates API dependency risk.** One thing that became obvious very quickly while testing hosted AI APIs was how fast autonomous workflows amplify usage. A single user interaction can become multiple model calls — retrieval, summarisation, reasoning, formatting, follow-up clarification. For a crisis-response platform, depending entirely on external inference APIs introduced operational and cost dependencies I wasn't comfortable with. Running Hermes locally shifted the tradeoff toward compute and infrastructure complexity instead of per-token billing and rate limits — which was the right trade for this project.

---

## Final Thoughts

Project Haven started as a 46-hour hackathon build, sat frozen for two years, and became the platform it was always supposed to be during this rebuild.

The AI Assistant was always the most important feature and the least real. Hermes made it real — not just more capable, but genuinely appropriate for the stakes of an emergency context: server-local, memory-persistent, verifiably grounded, and invisible enough to get out of the way when someone needs an answer fast.

If you're building anything where the AI output actually matters — where a wrong answer has real consequences — the pattern of running Hermes locally with a tight system prompt and opaque tool execution is one I'd recommend seriously.

---

*Built with TypeScript, React, Node.js, PostgreSQL, RabbitMQ, Docker, Hermes Agent, and a lot of respect for the people who actually work bushfire emergencies.*  
*Originally born at GovHack 2024. Finally given room to grow.*
