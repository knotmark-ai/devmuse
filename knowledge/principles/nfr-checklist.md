# Non-Functional Requirements Checklist

**When to use:** Referenced by mu-arch during design to systematically identify which NFR categories are relevant to the current feature. Scan the trigger conditions — only elaborate on categories where at least one trigger fires.

Based on ISO/IEC 25010 quality model and practical software engineering experience.

## NFR Categories

| # | Category | What it covers | Trigger conditions (elaborate if ANY fires) |
|---|----------|---------------|---------------------------------------------|
| 1 | **Performance** | Response time, throughput, resource utilization, latency budgets | High-traffic path; real-time requirements; large data volumes; user-facing latency sensitivity |
| 2 | **Scalability** | Horizontal/vertical scaling, elasticity, load distribution | Growing user base; variable/spiky load patterns; multi-tenant architecture |
| 3 | **Availability** | Uptime SLA, redundancy, failover, graceful degradation | Critical business path; SLA commitments; user-facing service; payment/checkout flows |
| 4 | **Reliability** | Fault tolerance, data consistency, recovery, retry strategies | Distributed transactions; eventual consistency; message delivery guarantees; idempotency requirements |
| 5 | **Security** | Authentication, authorization, encryption, data protection, input validation | Auth flows; PII handling; payment data; external-facing endpoints; file uploads; user-generated content |
| 6 | **Observability** | Logging, monitoring, alerting, distributed tracing | Complex multi-service flows; async processing; background jobs; debugging-critical paths |
| 7 | **Maintainability** | Modularity, testability, readability, upgrade path | Shared library/SDK; plugin architecture; code expected to change frequently |
| 8 | **Compatibility** | Backward compatibility, API versioning, interoperability | Public API changes; breaking schema changes; multi-client support (web/mobile/API); third-party integrations |
| 9 | **Portability** | Environment adaptability, deployment flexibility, platform independence | Multi-cloud deployment; on-prem + cloud; containerization; OS-specific dependencies |
| 10 | **Compliance** | Regulatory requirements, audit trails, data retention/deletion | GDPR/CCPA data; healthcare (HIPAA); financial data; audit logging requirements |
| 11 | **Migration** | Data migration, rollback strategy, feature flags, blue-green deployment | Schema changes on existing data; changing existing behavior; large user base; zero-downtime requirement |

## How to Use in mu-arch

1. **Scan:** After functional design is drafted, walk through the trigger conditions column. Mark categories where at least one trigger fires.
2. **Elaborate:** For each marked category, write 2-5 sentences covering: the specific concern, how the design addresses it, and any trade-offs.
3. **Skip explicitly:** Categories with no triggers firing can be omitted — no need to list them as "N/A".

## Example Output in Design Doc

```markdown
## Non-Functional Design

### Performance
This endpoint handles ~500 req/s at peak. Response time budget: <200ms p95.
Design uses database index on `user_id + created_at` to avoid full table scan.
Trade-off: index adds ~10% write overhead, acceptable given read-heavy pattern.

### Security
Endpoint accepts webhook callbacks from external payment provider.
Design validates webhook signature (HMAC-SHA256) before processing.
PII (email, phone) is logged at DEBUG level only, masked in INFO logs.

### Migration
Adding `timezone` column to existing `user_profile` table (~2M rows).
Strategy: nullable column + backfill migration + NOT NULL constraint in follow-up.
Rollback: drop column migration (backward compatible, no code depends on NOT NULL).
```
