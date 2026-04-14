# Architecture Assessment

**When to use:** Referenced by mu-scope (Quick Probe) and mu-arch (approach proposal) for selecting the right diagram type and level of detail. Also referenced by mu-reviewer review-design mode.

## Diagram Type by Project Type

Choose the right diagram type based on what the project is:

| Project type | Recommended diagrams | Why |
|---|---|---|
| CLI tool / Library | C3 Component | No multi-container complexity; component relationships suffice |
| Web app (frontend + backend + DB) | C1 Context + C2 Container | Need system boundary + tech stack containers |
| Microservices | C1 Context + C2 Container + Data Flow | Service interactions are the core complexity |
| Plugin / Extension | C1 Context (host relationship) + C3 Component | "Where do I fit in the host system?" is the key question |
| Data pipeline | Data Flow Diagram (primary) | How data flows and transforms is the core concern |
| API service | C2 Container + API boundary | Need inside/outside boundary + tech containers |
| Mobile app | C1 Context + C2 Container | Device ↔ cloud ↔ third-party relationships |

## C4 Model Quick Reference

Use only the levels that add clarity. Most projects need 1-2 levels, not all 4.

### C1: System Context
"What is this system and who/what interacts with it?"

```mermaid
graph TB
    User["👤 User"] --> System["🔷 Our System"]
    System --> ExtA["📦 External System A"]
    System --> ExtB["📦 External System B"]
```

**When to include:** Always for new systems. For changes to existing systems, include when the change affects external interactions.

### C2: Container
"What are the major technical building blocks?"

```mermaid
graph TB
    subgraph System
        WebApp["🌐 Web App<br/>React"]
        API["⚙️ API Server<br/>Node.js"]
        DB["🗄️ Database<br/>PostgreSQL"]
        Queue["📨 Message Queue<br/>Redis"]
    end
    WebApp --> API
    API --> DB
    API --> Queue
```

**When to include:** When the system has multiple deployable units (server, database, queue, etc.).

### C3: Component
"What are the major structural pieces inside a container?"

```mermaid
graph TB
    subgraph API Server
        Router["Router"]
        AuthMiddleware["Auth Middleware"]
        UserService["User Service"]
        OrderService["Order Service"]
        Repository["Repository Layer"]
    end
    Router --> AuthMiddleware
    AuthMiddleware --> UserService
    AuthMiddleware --> OrderService
    UserService --> Repository
    OrderService --> Repository
```

**When to include:** When the change adds/modifies components within a container.

### Data Flow Diagram
"How does data move through the system?"

```mermaid
graph LR
    Input["User Input"] --> Validate["Validate"]
    Validate --> Process["Process"]
    Process --> Store["Store"]
    Store --> Notify["Notify"]
    Notify --> Output["User Response"]
```

**When to include:** When the change introduces or modifies a data processing path.

## Change Overlay Notation

When showing proposed changes on an existing architecture diagram:
- ➕ New component/connection
- ✏️ Modified component/connection
- ➖ Removed component/connection

## Diagram Format

- **Preferred:** Mermaid (renders natively on GitHub, in IDEs, and in design docs)
- **Fallback:** ASCII art (when working in contexts without Mermaid rendering)
- **Rule:** Diagrams live in the design spec, not in a separate file. They are part of the design, not standalone artifacts.

## When to Skip Detailed Diagrams

- Bug fixes that don't change component boundaries
- Config changes, documentation-only changes, test-only changes
- Quick Probe shows: 1 component affected, no boundaries crossed, no new components → brief text description suffices
