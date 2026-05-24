# Project Haven — Copilot Instructions

## Project Overview

Project Haven is an AI-powered emergency response and disaster recovery platform for bushfire preparedness, evacuation assistance, and post-disaster support. It combines predictive analytics, GenAI recommendations, event-driven microservices, and an offline-first PWA.

---

## Repository Structure

```
project-haven/
├── client/                  # React + TypeScript + Vite PWA
├── server/
│   ├── api-gateway/
│   ├── user-service/
│   ├── feed-service/
│   ├── prediction-service/
│   ├── safe-space-service/
│   ├── recommendation-service/
│   ├── alert-service/
│   └── shared/
├── notebooks/               # ML / EDA notebooks (Python)
├── infrastructure/          # Docker, Kubernetes, IaC
├── docs/
└── openapi/                 # OpenAPI 3.1 contract files
```

---

## Code Generation Rules

- **Prefer TypeScript** for all backend services and the frontend.
- Generate **OpenAPI 3.1 specs before implementations** — contract-first.
- Use **strong typing** throughout; avoid `any`.
- Apply **clean architecture**: separate domain logic, application layer, and infrastructure.
- Follow **SOLID principles** and prefer **composition over inheritance**.
- Use **DTOs and validation schemas** at all service boundaries.
- Use **dependency injection** where possible.
- Apply **async, event-driven patterns** for inter-service communication.
- Include **unit tests by default** with every new service or domain function.
- Add **observability hooks** (structured logging, correlation IDs, distributed tracing) to every service.
- Avoid tight coupling between services — communicate via events, not direct calls.

---

## Architecture Patterns

- **Microservices** with clear bounded contexts.
- **Event-driven** via Kafka / Redpanda / RabbitMQ / Google Pub/Sub.
- **CQRS**: write DB for mutations (user signup, location updates); read DB for queries (recommendations, evacuation lookup, offline sync).
- **API-first**: all service contracts defined in OpenAPI before code.
- **Eventual consistency** across services.

### Event Contract Shape

```ts
Event {
  eventId: UUID
  correlationId: UUID
  timestamp: timestamp
  source: string
  version: string
  payload: object
}
```

### Core Events

`user.created` · `location.updated` · `weather.updated` · `bushfire.predicted` · `alert.generated` · `feed.created` · `safe-space.updated`

---

## Services

| Service | Key Responsibilities |
|---|---|
| **User Service** | CRUD users, notification prefs, location, JWT auth, audit logging |
| **Feed Service** | Community feed, emergency updates, high-write event stream |
| **Prediction Service** | Bushfire likelihood from weather streams + historical data |
| **Safe Space Service** | Evacuation point recommendations, offline support |
| **Recommendation Service** | GenAI grants, housing and recovery guidance |
| **Alert Service** | Push notifications, <5s delivery, retry + offline sync |

---

## Frontend (client/)

- **Stack**: React, TypeScript, Vite, PWA (Service Workers, IndexedDB).
- **Offline-first**: cache evacuation points, alerts, weather, preferences, service recommendations.
- **Sync strategy**: network-first → cache fallback → background sync → conflict reconciliation.
- **Service Worker** handles asset caching, API caching, push notifications, and offline sync queue.

### Frontend Structure

```
client/src/
├── components/
├── pages/
├── services/
├── hooks/
├── store/
├── workers/
├── offline/
└── types/
```

---

## UI/UX Specifications

### Design Principles

- **Emergency-first UX**: optimise every interaction for crisis scenarios.
- **Minimal cognitive load**: surface only what matters in the moment.
- **Mobile-first** responsive design with one-handed usability.
- **High contrast** + large touch targets for emergency actions.
- **Offline-aware**: always indicate connectivity state and data freshness.

### Color System

| Color | Meaning |
|---|---|
| Red | Active danger |
| Orange | Warning |
| Yellow | Caution |
| Green | Safe zones |
| Blue | Informational |

### Accessibility

- WCAG AA compliant contrast ratios.
- Dark mode support.
- Reduced motion support.
- Screen reader + keyboard navigation support.
- Dynamic font scaling.

### Primary Screens

| Screen | Key Components |
|---|---|
| **Emergency Dashboard** | Risk severity banner, interactive map, safe space cards, live weather widget, alert feed, quick CTA buttons |
| **Safe Space Recommendations** | Map with route overlays, evacuation cards with ETA, accessibility badges, capacity indicators |
| **Live Alerts** | Priority-tiered notifications (critical → full-screen, high → persistent, medium → toast, low → feed) |
| **Recovery Support** | Grant/service recommendation cards, eligibility indicators, AI-generated guidance summaries |
| **Community Feed** | Feed cards, verification badges, location tags, real-time updates |
| **Offline Mode** | Offline banner, stale-data timestamps, pending action queue, auto-sync indicator |

### Alert Priority Behaviour

| Priority | UI Behaviour |
|---|---|
| Critical | Full-screen banner + vibration |
| High | Persistent notification |
| Medium | Toast notification |
| Low | Feed update |

### Component Rules

- Card-based layouts throughout.
- Sticky emergency action buttons on all screens.
- Offline banner shown globally when disconnected.
- Stale data timestamps shown on cached content.
- Accessibility badges on all evacuation points.

---

## Security Requirements

- **JWT authentication** with token expiry enforcement; OAuth2 compatible.
- **RBAC** with least-privilege access.
- **Hash PII** (e.g. email) — never store plaintext sensitive data.
- Encrypt data at rest and in transit.
- Use secret management (no hardcoded secrets).
- Validate all inputs at service boundaries.

---

## AI / GenAI Guardrails

- No hallucinated emergency advice — use verified datasets only.
- Confidence-aware responses; surface uncertainty explicitly.
- Explainable AI outputs for prediction results.
- Human verification required for critical alert generation.

---

## Non-Functional Targets

| Requirement | Target |
|---|---|
| API latency | < 300 ms |
| Alert delivery | < 5 s |
| Offline startup | < 2 s |
| Prediction processing | Near real-time |

- Stateless, horizontally scalable services.
- Retry mechanisms, circuit breakers, health checks, graceful degradation.

---

## Testing Requirements

- **Unit tests**: all services, domain logic, validation.
- **Integration tests**: event flows, DB interactions, API communication, offline sync.
- **Load tests**: emergency traffic spikes, event throughput, notification scaling.

---

## DevOps

- Docker + Kubernetes; Infrastructure as Code.
- CI/CD pipeline: lint → unit tests → contract tests → security scan → integration tests → container build → deploy.

---

## Definition of Done

A feature is complete only when:

1. Tests pass.
2. OpenAPI contract updated.
3. Security checks pass.
4. Observability (logging + tracing) added.
5. Offline support validated (if applicable).
