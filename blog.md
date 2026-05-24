# Project Haven: From Hackathon Win to Something That Actually Matters

*This is a submission for the [GitHub Finish-Up-A-Thon Challenge](https://dev.to/challenges/github-2026-05-21)*

---

## What I Built

Project Haven is an AI-powered emergency response and disaster recovery platform built specifically for bushfire preparedness — helping people find safe evacuation points, receive real-time alerts, access government recovery support, and stay informed even when the internet cuts out.

The core idea is simple but important: **during a bushfire, information is survival**. Where are the nearest evacuation centres? How bad is the risk right now? What government grants can I apply for after my home is damaged? Project Haven tries to answer all of that — fast, reliably, and even offline.

Under the hood, the platform combines:

- **Predictive analytics** — a bushfire risk engine combining the McArthur FFDI Mark 5 formula (official BOM standard) with an XGBoost model trained on GA historical fire data, running as a Python sidecar blended at 80/20
- **Smart evacuation routing** — nearest safe space recommendations with distance and ETA
- **AI-powered recovery support** — scenario-based government grants and services backed by live AI research via Nous Hermes 2 (real ones, like the Disaster Recovery Payment and Primary Producer Recovery Grant)
- **Live emergency guidance** — an AI Assistant powered by Nous Hermes 2 running locally via Ollama; real conversational responses grounded in Australian emergency protocols, with a system prompt that escalates to 000 when needed
- **Live community feed** — on-the-ground updates from people in affected areas
- **Real-time alerts** — tiered notifications from low-priority feed updates to full-screen critical banners
- **Offline-first PWA** — because during emergencies, mobile networks are the first thing to go

The architecture is fully event-driven microservices: a prediction service subscribes to weather updates, runs the FFDI engine blended with an XGBoost model-service sidecar (Python/FastAPI, trained from GA bushfire boundaries and baked into Docker at build time), publishes bushfire predictions, and the alert service automatically generates tiered notifications from those predictions. All async. All decoupled. RabbitMQ handling the message bus, PostgreSQL for persistence, React PWA for the frontend, everything containerised and wired together with Docker Compose — including a local Ollama instance serving Nous Hermes 2 for the AI Assistant, grant research, and scheduled fire-season briefings.

The part I'm still most proud of? The offline-first thinking. The app caches evacuation points, alerts, and recommendations locally. If connectivity drops mid-crisis — which it will — the app keeps working.

---

## Demo

> 🔗 **GitHub Repository:** [project-haven](https://github.com/ujja/project-haven) *(add your link here)*

### Running it locally

```bash
cp .env.example .env
docker compose up --build
```

That's it. One command spins up 6 microservices, an API gateway, PostgreSQL instances, RabbitMQ, and the React PWA at `http://localhost:3000`.

To trigger the full prediction → alert pipeline:

```bash
curl -X POST http://localhost:8080/weather \
  -H 'Content-Type: application/json' \
  -d '{"lat":-33.87,"lng":151.21,"temperature":42,"windSpeed":80,"humidity":10,"season":"summer","vegetationDensity":0.9}'
```

That simulates an extreme weather event near Sydney, runs it through the prediction engine, and fires a CRITICAL alert through the system within seconds.

> 📸 *Add screenshots here: emergency dashboard, live alerts, safe space cards, offline mode, architecture diagram*

---

## The Comeback Story

Okay, here's the honest version.

Project Haven was built for [**GovHack 2024**](https://govhack.org/)

If you've never done GovHack — it's a 46-hour hackathon using Australian government open data. You show up, pick a problem, build something, demo it, and hope the judges like it.

We showed up with the idea of building something that could actually help people during bushfire emergencies. Real datasets. Real data analysis. A real prediction model. We used the Digital Atlas historical bushfire boundaries CSV and ABS community datasets, built XGBoost models in Jupyter notebooks, and sketched out an event-driven microservice architecture on a whiteboard.

No UI. No running backend. Just the notebooks, the numbers, and a vision for what the system *could* be.

**And we won.**

Which was incredible. Genuinely one of those moments you don't forget.

And then... the project just sat there.

Because that's what happens after hackathons. The adrenaline drops. Everyone goes home. You sleep for two days. You go back to work on Monday. Life continues.

The codebase stayed frozen. The notebooks stayed frozen. The architecture stayed frozen — as a snapshot of an idea that had way more potential than a 46-hour demo ever got to show.

Not because the problem wasn't worth solving. Bushfire preparedness is genuinely important in Australia. Climate change is making it worse every year. The gap between what exists and what communities actually need during emergencies is still very real.

But once the goal is achieved, you move on. That's just human nature.

---

So when the **GitHub Finish-Up-A-Thon** came up, I immediately thought of Project Haven.

Because going back to old projects is a weird and strangely satisfying experience.

You look at the code and you see everything at once — the shortcuts you took at 2am, the TODOs you never came back to, the half-implemented features, the places where "good enough for demo day" was the bar. But you also see the original intent underneath all of it. And sometimes that intent is still worth pursuing.

This time, instead of treating it like a hackathon submission, I started treating it like an actual platform.

That meant a completely different mindset:

**Before (hackathon mode):**
- A system design architecture diagram
- Jupyter notebooks with some number crunching
- No UI. No backend. Just the idea and the data analysis.
- "We'll build the rest... later"

**After (product mode):**
- Contract-first OpenAPI specs before any implementation
- Proper microservice boundaries with clear domain ownership
- Real TypeScript throughout — strict mode, no `any`, proper DTOs
- Shared event contracts so every service speaks the same language
- End-to-end Docker setup so anyone can run it with one command
- Offline-first PWA with Workbox service workers, not just a checkbox
- A prediction engine that actually reflects the model weights from our notebooks
- Real Australian government services and grants seeded into the recommendation service
- Full lucide-react icon system, proper design tokens, accessible UI

One of the biggest architectural calls was how to handle the shared module. Every service needed the same event shapes, DTOs, and logger. Instead of duplicating types everywhere (the hackathon approach), I built `@haven/shared` as a proper local npm package that each service depends on. The Dockerfiles build it first, then link it. Small thing, but it's the kind of thing that makes a codebase actually maintainable.

Another big one was the prediction engine. Our XGBoost notebooks had a trained model for fire risk prediction. And here I'll be fully honest: I'm not a data scientist. During the hackathon I didn't really know what I was doing with the notebooks. I just sort of... cooked up weights that felt plausible. Temperature matters a lot? Sure, give it 0.35. Wind is bad? 0.25. Humidity inverse, obviously. Slap some season bonuses on. Done. Ship it.

Copilot called this out completely. Not in a confrontational way — but when I started asking about the prediction engine during the rebuild, it surfaced the actual problems: the `test_size=0.8` split that meant the model was *training on 20%* of the data and validating on 80% (backwards), the `area_ha < 3` outlier filter that was literally removing all the dangerous large fires from the training set, and — most damningly — the fact that the XGBoost model was predicting *fire size* from historical boundary features while the TypeScript engine was computing a *risk score* from weather inputs. They were solving completely different problems. The weights I'd put in had no relationship to anything the notebook had analysed. They were just numbers I made up at 2am that sounded reasonable.

So instead of just transcribing invented numbers, we rebuilt it properly. The engine now implements the McArthur Forest Fire Danger Index (FFDI) Mark 5 — the actual formula used by the Bureau of Meteorology and every Australian state fire service. The notebook was fixed (correct 80/20 train/test split, log-IQR outlier handling to keep the large fires), and the XGBoost model now serves a real purpose: predicting expected fire size (in hectares) for a given state and month, used as a historical context signal blended at 20% weight into the FFDI weather score. The XGBoost model now runs as a proper Python `model-service` FastAPI sidecar, trained at Docker build time from the GA Historical Bushfire Boundaries dataset and baked into the image so startup is instant. The prediction service calls it asynchronously with a 2-second timeout; if it's unreachable, FFDI-only scoring kicks in — no hard dependency on the critical path.

The "I just made numbers up" moment is a good illustration of why having something that can actually interrogate your assumptions matters, especially when you're working outside your domain.

The whole thing went from "hackathon skeleton with mock data" to a working end-to-end system you can actually spin up and test. Weather event goes in, prediction comes out, alert fires, PWA displays it — all observable, all local, all real.

---

## My Experience with GitHub Copilot

I used GitHub Copilot as the primary engineering partner throughout this comeback — not as an autocomplete tool, but as a **system-aware collaborator that held the full architecture in context while I worked**.

### Setting the stage: copilot-instructions.md

The first thing I did before writing a single line of implementation was write `.github/copilot-instructions.md` — a detailed spec covering the service boundaries, event contract shapes, CQRS split, security requirements, and UI/UX principles. Every rule I wanted enforced (contract-first OpenAPI, no `any`, DTOs at boundaries, observability hooks, WCAG AA) went in there.

That file became the foundation everything else was built on. Copilot read it before every response and generated code that conformed to patterns I'd already established — not guessing at conventions, but following documented ones. The difference in output quality was significant.

### Scaffolding 6 microservices from a shared pattern

The biggest single time-save was scaffolding all six backend services. Each needed the same structure: Express app, `helmet` + `cors` + `morgan`, a rate limiter, a structured logger from `@haven/shared`, a postgres schema init with seed data, RabbitMQ pub/sub wiring, health endpoints, and a multi-stage Dockerfile that builds `@haven/shared` first and links it.

That's probably 150 lines of consistent boilerplate per service. With Copilot understanding the pattern from the first service, each subsequent one took minutes rather than hours — and they were consistent in ways that matter: same error envelope shape, same correlation ID middleware, same health check format, same log field names.

### The shared module problem

Every service needed the same event shapes, DTOs, and logger. The hackathon approach was to duplicate them. The right approach was `@haven/shared` — a local npm package with its own `tsconfig`, built first in Docker, then installed into each service via `file:` resolution.

Working out the correct multi-stage Dockerfile pattern for this (build shared → copy dist → npm install in service context) is fiddly. Copilot got it right on the first pass and applied it consistently across all six service Dockerfiles and the Docker Compose dependency graph.

### Transcribing XGBoost weights into TypeScript

Our GovHack notebooks had a trained XGBoost model for fire risk prediction. Rather than running a Python sidecar in Docker, I wanted the prediction logic native to the Node service — self-contained, no cross-language IPC.

I showed Copilot the notebook's feature importances and coefficient output. It generated a TypeScript heuristic engine that replicated the same decision logic: weighted inputs for temperature, humidity, wind speed, vegetation density, and season; thresholds mapped to severity levels; confidence intervals from the training accuracy. Same model, different runtime. The prediction output matched what the notebook produced for the same inputs.

### Rebuilding the entire UI from scratch

The hackathon UI was functional but wrong for the use case. Emergency UX has specific demands — high contrast, large touch targets, one-handed mobile use, offline indicators, priority-tiered alert behaviour. None of the original components were built with any of that in mind.

Copilot rebuilt the entire frontend systematically:

- **Design system** — a new `index.css` with semantic CSS variables (`--c-critical`, `--c-high`, `--c-medium`, `--c-safe`, spacing tokens, radius tokens, `--nav-w` for sidebar width, `--header-h` for page header clearance) and glassmorphism card styles
- **Left sidebar nav** — rebuilt navigation from a mobile bottom bar to a 220px fixed left sidebar with icon + label rows, an active state indicator bar, online/offline status dot, and AI assistant + Settings links pinned at the bottom; collapses to a 60px icon-only rail at `< 768px`
- **Page headers with back navigation** — every screen except the dashboard has a sticky `52px` page header with a `ChevronLeft` back button that calls `navigate(-1)`, giving the app proper browser-history navigation without a router-level back stack
- **Web app layout** — removed the `430px` phone-shell constraint and switched the root layout to `display: flex; flex-direction: row` so the sidebar and content fill the viewport side by side; no `max-width` on the main content area
- **Emergency dashboard** — risk severity banner with animated pulse on CRITICAL, two-column grid layout (map + stat tiles on the left, live alerts + nearest safe spaces on the right at `380px`), sticky CTA buttons
- **Alert overlay** — full-screen takeover for CRITICAL priority alerts with haptic-style dismiss, priority-tiered behaviour (CRITICAL → full screen, HIGH → persistent, MEDIUM → toast, LOW → feed)
- **Three new screens** — Onboarding (4-step permissions flow), Settings (toggles, emergency contacts, accessibility), AI Assistant (chat interface — now backed by Nous Hermes 2 via Ollama)

All components used the design token system consistently — no hardcoded hex values, no magic numbers.

### Atlas data enrichment and real open data

The static seed data was a starting point, not a destination. I wanted the platform to pull from the best available Australian open data sources at startup — live fire detections, real evacuation assembly points, current government grants.

Copilot initially wrote three `atlasEnrich.ts` files using Geoscience Australia's Digital Atlas ArcGIS REST endpoints — a good foundation. But GA polygon data only goes so far, especially for fire detection where you want sub-3-hour satellite observations. So we went further.

The final enrichment pipeline by service:

**safe-space-service** — GA Atlas (topographic facilities) → **OpenStreetMap Overpass API** (no key required). The Overpass query targets `emergency=assembly_point`, `emergency=evacuation_point`, and `amenity=evacuation_centre` nodes within the Australia bounding box. OSM has surprisingly comprehensive coverage of designated emergency assembly points that don't appear in government datasets. Accessibility tags (`wheelchair`, `toilets_wheelchair`, `parking_disabled`, `pets`) are read directly from OSM node tags.

**prediction-service** — A four-source priority cascade: **NASA FIRMS VIIRS NRT satellite detections** (3-hour near-real-time, requires a free MAP_KEY) → **VIC Emergency public JSON feed** (no key) → **NSW RFS major incidents JSON feed** (no key) → GA vegetation polygon centroids → static fallback. The FIRMS response includes fire radiative power (`frp`) in MW and string confidence values (`'l'`, `'n'`, `'h'`) which map to numeric probabilities for the risk engine. If FIRMS data exists, the live state feeds supplement it. If nothing is reachable, the static seed ensures the service always starts with plausible data.

**recommendation-service** — Curated seed of known recovery programs → GA Atlas community facilities → **GrantConnect API** (`/v2/grants?keyword=bushfire+disaster&status=open`, requires free API key). GrantConnect is the Australian Government's official grants database. The integration maps grant categories to the service's scenario taxonomy (`GRANT`, `RECOVERY`, `HOUSING`, `HEALTH`, `EMERGENCY`) and deduplicates on `(scenario, title)`.

All three are fire-and-forget calls in each service's `start()` — never blocking, never throwing, always falling back gracefully. Both API keys (`NASA_FIRMS_MAP_KEY`, `GRANTCONNECT_API_KEY`) are optional environment variables documented in `.env.example`.

### Debugging the ON CONFLICT DO NOTHING silent failure

After wiring up the enrichment layer, the recommendation and safe-space services kept inserting duplicate rows on every restart. The `ON CONFLICT DO NOTHING` clause was there — visually it looked correct. But it silently did nothing.

The root cause: every INSERT was using `gen_random_uuid()` as the primary key. UUID PKs are always unique by definition, so `ON CONFLICT` on the PK could never trigger. There was no other unique constraint, so duplicates streamed in on every startup.

The fix was two-part: add `UNIQUE` constraints on natural keys (`name` for safe spaces, `(scenario, title)` for recommendations) idempotently in the service's `init()` via a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_table THEN NULL; END $$` block, then update every INSERT — both seed and enrichment — to specify the column: `ON CONFLICT (name) DO NOTHING`. Copilot caught that the same pattern existed in all three `atlasEnrich.ts` files and fixed them in one pass.

### Debugging the amqplib type breaking change

Mid-rebuild, four services stopped compiling. The `amqplib` types had changed between versions — `Connection` became `ChannelModel`, and import paths shifted. The errors were spread across `bus.ts` in every service that used the message broker.

Rather than hunting them down one by one, Copilot identified the pattern across all four files at once and applied the fix consistently: updated import paths, replaced `Connection` with `ChannelModel`, added the `.channel` access where the API had changed. What would have been 20 minutes of grep-and-fix was one operation.

### The quality multiplier

The pattern I noticed across all of this: **Copilot's output quality scaled directly with the quality of my specifications**.

Vague prompt → vague result. But when the architecture was documented, the event contracts were defined, and the patterns were established in real code — Copilot could work within all of those constraints simultaneously. It wasn't generating generic Express boilerplate. It was generating Express code that matched the correlation ID middleware pattern, used the shared logger with the right field names, published events with the correct envelope shape, and returned errors in the `{ code, message }` format defined in the OpenAPI spec.

That's the real leverage. Not autocomplete. **Specification → conforming implementation at speed.**

---

## Final Thoughts

There's a whole graveyard of hackathon projects in GitHub repositories everywhere.

Most of them deserved more time than they got.

Project Haven started as a 46-hour sprint, won a competition, and then sat untouched for almost two years. This challenge gave me the push to go back and ask: what would this actually look like if it was built properly?

The answer turned out to be: a lot better.

The prediction pipeline works end-to-end. The offline-first architecture actually functions. The microservices actually talk to each other through real events. The UI is a full-width web application — not a phone simulator in a browser — with proper sidebar navigation, back-button routing, and a two-column dashboard that uses screen real estate the way a desktop tool should. Live fire detections from NASA satellites, real Australian evacuation assembly points from OpenStreetMap, and current government grants from GrantConnect flow in at startup. The AI Assistant — previously a `setTimeout` and a `switch` statement of canned responses — is now backed by Nous Hermes 2 running locally via Ollama, with a system prompt grounded in verified Australian emergency protocols. The prediction engine now implements the McArthur FFDI Mark 5 formula (the actual BOM standard) blended with an XGBoost model trained from real GA historical fire data — running as a Python FastAPI sidecar built into Docker — replacing the made-up weights from the hackathon. The whole thing runs with a single `docker compose up --build`.

None of that would have happened at this pace working solo without Copilot. Not because any individual piece was impossible — but because the sheer volume of consistent, conforming implementation across six services, a shared module, a full UI rebuild, a data enrichment layer across four distinct external APIs, and edge cases like the `ON CONFLICT` silent failure would have taken weeks of context-switching. With Copilot holding the system context and working within the established patterns, it compressed into days.

I'm not saying it's done. There's still proper auth flows, load testing, mobile push notifications, and a dozen other things on the list.

But it's no longer frozen in time as a hackathon demo.

It feels like something that could actually help someone.

And that's probably the best thing this challenge could have done.

---

*Built with TypeScript, React, Node.js, Python (FastAPI + XGBoost), PostgreSQL, RabbitMQ, Docker, Ollama (Nous Hermes 2), and GitHub Copilot.*  
*Originally born at GovHack 2024. Finally given room to grow.*
