# OpportunityPilot

# Development Task Roadmap

Version: 1.0

Status: Active

---

# Purpose

This document defines every development task required to complete the MVP.

Tasks should be completed sequentially unless explicitly marked as parallel.

Each task must satisfy the Definition of Done described in DEVELOPMENT_RULES.md.

No task is considered complete unless:

- Code builds successfully
- Type checking passes
- Lint passes
- Documentation remains consistent
- Existing functionality is not broken

---

# Project Progress

Phase 1

☐ Not Started

Phase 2

☐ Not Started

Phase 3

☐ Not Started

...

---

# Phase 1 — Project Foundation

## SETUP-001

Initialize Next.js project using App Router.

Priority

Critical

Status

Pending

---

## SETUP-002

Configure TypeScript.

Priority

Critical

Status

Pending

---

## SETUP-003

Configure TailwindCSS.

Priority

Critical

Status

Pending

---

## SETUP-004

Install and configure shadcn/ui.

Priority

Critical

Status

Pending

---

## SETUP-005

Configure ESLint and Prettier.

Priority

Critical

Status

Pending

---

## SETUP-006

Create folder structure.

Priority

Critical

Status

Pending

---

## SETUP-007

Configure environment variable handling.

Priority

Critical

Status

Pending

---

# Phase 2 — Database

## DB-001

Install Prisma.

---

## DB-002

Connect Amazon RDS PostgreSQL.

---

## DB-003

Create User schema.

---

## DB-004

Create Resume schema.

---

## DB-005

Create Opportunity schema.

---

## DB-006

Create RecruiterEmail schema.

---

## DB-007

Create Application schema.

---

## DB-008

Create ActivityLog schema.

---

## DB-009

Generate initial migration.

---

## DB-010

Seed development database.

---

# Phase 3 — Authentication

## AUTH-001

Configure Google OAuth.

---

## AUTH-002

Create login page.

---

## AUTH-003

Implement authentication middleware.

---

## AUTH-004

Protect private routes.

---

## AUTH-005

Session management.

---

# Phase 4 — Gmail Integration

## GMAIL-001

Connect Gmail API.

---

## GMAIL-002

Implement Gmail Watch API.

---

## GMAIL-003

Configure Pub/Sub webhook.

---

## GMAIL-004

Receive Gmail notifications.

---

## GMAIL-005

Download placement email.

---

## GMAIL-006

Keyword filtering.

---

# Phase 5 — AI Integration

## AI-001

Connect Company Extraction API.

---

## AI-002

Validate extracted company.

---

## AI-003

Handle extraction failures.

---

# Phase 6 — Hunter API

## HUNTER-001

Connect Hunter API.

---

## HUNTER-002

Store recruiter emails.

---

## HUNTER-003

Handle empty responses.

---

# Phase 7 — Dashboard

## DASH-001

Dashboard layout.

---

## DASH-002

Statistics cards.

---

## DASH-003

Opportunity table.

---

## DASH-004

Search.

---

## DASH-005

Filtering.

---

## DASH-006

Sorting.

---

## DASH-007

Details drawer.

---

# Phase 8 — Resume

## RESUME-001

Upload PDF.

---

## RESUME-002

Store in Amazon S3.

---

## RESUME-003

Replace resume.

---

## RESUME-004

Delete resume.

---

# Phase 9 — Email

## EMAIL-001

Email editor.

---

## EMAIL-002

Draft saving.

---

## EMAIL-003

Attach resume.

---

## EMAIL-004

Send Gmail.

---

## EMAIL-005

Store Gmail thread ID.

---

# Phase 10 — Follow-ups

## FOLLOWUP-001

Create scheduler.

---

## FOLLOWUP-002

EventBridge integration.

---

## FOLLOWUP-003

SQS integration.

---

## FOLLOWUP-004

Retry every seven days.

---

## FOLLOWUP-005

Stop after five attempts.

---

# Phase 11 — Reply Detection

## REPLY-001

Watch Gmail replies.

---

## REPLY-002

Update application status.

---

## REPLY-003

Cancel future follow-ups.

---

# Phase 12 — Timeline

## LOG-001

Create Activity Logger.

---

## LOG-002

Timeline UI.

---

## LOG-003

Display chronological history.

---

# Phase 13 — Settings

## SETTINGS-001

Settings page.

---

## SETTINGS-002

Keyword management.

---

## SETTINGS-003

Follow-up interval.

---

## SETTINGS-004

Maximum attempts.

---

# Phase 14 — Polish

## POLISH-001

Loading states.

---

## POLISH-002

Empty states.

---

## POLISH-003

Error states.

---

## POLISH-004

Responsive layout.

---

## POLISH-005

Accessibility improvements.

---

# Phase 15 — Testing

## TEST-001

Authentication testing.

---

## TEST-002

Database testing.

---

## TEST-003

API testing.

---

## TEST-004

Dashboard testing.

---

## TEST-005

End-to-end testing.

---

# MVP Completion Checklist

Authentication

☐

Database

☐

Dashboard

☐

Resume Upload

☐

Company Extraction

☐

Hunter API

☐

Email Sending

☐

Follow-ups

☐

Reply Detection

☐

Settings

☐

Analytics

☐

Production Ready

☐

---

# Future Tasks

Do not begin these until MVP is complete.

- Resume scoring
- LinkedIn integration
- Chrome extension
- Mobile app
- Notifications
- AI analytics
- Team collaboration