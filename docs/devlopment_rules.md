# Architecture Decision Record (ADR)

## ADR-001

Decision:
Use Gmail Watch API instead of polling.

Reason:
Real-time notifications.
Lower API usage.
Lower cost.
Scalable.

---

## ADR-002

Decision:
Store resumes in Amazon S3.

Reason:
Large binary files should not be stored in PostgreSQL.

---

## ADR-003

Decision:
Use Hunter API.

Reason:
Simple integration.
Lower cost than Apollo.

---

## ADR-004

Decision:
Users manually write email content.

Reason:
Maintain personalization.
Avoid AI hallucinations.
User retains full control.

---

## ADR-005

Decision:
Follow-ups continue in the same Gmail thread.

Reason:
Professional communication.
Improved recruiter experience.