# OpportunityPilot

# Architecture Decisions

Version: 1.0

---

## ADR-001

Status

Accepted

Decision

Use Gmail Watch API.

Context

Need real-time Gmail notifications.

Alternatives

- Poll every minute
- Poll every five minutes
- Gmail Watch API

Decision

Use Gmail Watch API.

Reason

- Lower API usage
- Real-time
- Better scalability

Consequences

Requires Pub/Sub.

---

## ADR-002

Decision

Use Amazon RDS PostgreSQL.

Alternatives

- MongoDB
- DynamoDB
- Firebase

Reason

Relational data.

Strong consistency.

Prisma support.

---

## ADR-003

Decision

Store resumes in Amazon S3.

Reason

Binary files do not belong in PostgreSQL.

---

## ADR-004

Decision

Users manually write outreach emails.

Reason

Maintain personalization.

Avoid AI hallucinations.

---

## ADR-005

Decision

Hunter API for recruiter discovery.

Reason

Simple integration.

Affordable pricing.

---

## ADR-006

Decision

EventBridge + SQS for follow-ups.

Reason

Reliable scheduling.

Retry support.

Scalable.

---

## ADR-007

Decision

Follow-ups remain inside the same Gmail thread.

Reason

Professional communication.

Cleaner recruiter experience.