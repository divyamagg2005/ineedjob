# AGENTS.md

# OpportunityPilot AI Development Guide

> This repository is designed to be developed collaboratively with AI coding agents.
> Every AI agent MUST read this file before making any code changes.

---

# Project Overview

OpportunityPilot is an event-driven internship outreach platform.

The application automatically detects placement emails from Gmail, extracts the hiring company, discovers recruiter email addresses, and allows users to manually send personalized outreach emails with automated follow-up scheduling.

The architecture is intentionally documented in detail.

Do not make assumptions.

Read the documentation first.

---

# Required Reading Order

Before writing or modifying any code, read the following files in this exact order.

1. docs/PRD.md
2. docs/ARCHITECTURE.md
3. docs/DATABASE.md
4. docs/WORKFLOW.md
5. docs/API_SPEC.md
6. docs/UI_UX.md
7. docs/AWS_INFRASTRUCTURE.md
8. docs/DEVELOPMENT_RULES.md
9. docs/DECISIONS.md

If documentation and implementation conflict,

documentation wins.

---

# Core Philosophy

This project prioritizes

- readability
- maintainability
- consistency
- correctness

over

- clever code
- unnecessary abstractions
- premature optimization

When in doubt,

choose the simpler implementation.

---

# Project Scope

Implement only the documented MVP.

Do not implement future roadmap features.

Do not add experimental functionality.

Do not "improve" the architecture unless explicitly requested.

---

# Before Writing Code

Always

✔ Search existing code.

✔ Search existing components.

✔ Search existing services.

✔ Search existing hooks.

✔ Search existing utilities.

Reuse existing code whenever possible.

Avoid duplication.

---

# Architecture Rules

Never

- Skip the service layer.
- Access the database directly from controllers.
- Access the database from React.
- Access Gmail directly from the frontend.
- Bypass authentication.
- Bypass validation.

All external APIs must be accessed through backend services.

---

# Frontend Rules

Use

Next.js App Router

Server Components by default.

Client Components only when required.

Business logic belongs inside services or hooks.

React components should remain presentation-focused.

---

# Backend Rules

Controllers

↓

Services

↓

Repositories

↓

Database

Never violate this architecture.

---

# Database Rules

Use Prisma only.

Never introduce another ORM.

Never duplicate tables.

Never change schema without updating DATABASE.md.

---

# API Rules

Never invent endpoints.

Only implement endpoints defined inside API_SPEC.md.

If an endpoint is missing,

ask before creating one.

---

# UI Rules

Never redesign layouts.

Never replace tables with cards.

Never replace drawers with pages.

Follow UI_UX.md exactly.

---

# AI Usage Rules

AI is permitted only for

- Company name extraction

AI must never

- Generate outreach emails
- Rewrite user emails
- Automatically send first outreach
- Make hiring decisions

---

# Dependencies

Before adding any dependency,

check whether

- React
- Next.js
- Node
- Existing libraries

already solve the problem.

Avoid unnecessary packages.

---

# Refactoring

Refactor only when

- complexity decreases
- readability improves

Never refactor unrelated code.

Never perform project-wide refactors without approval.

---

# File Creation Rules

Before creating a new file,

check whether

an existing file can be extended.

Avoid

Utils.ts

Helpers.ts

Common.ts

unless absolutely necessary.

---

# Pull Request Mindset

Every completed task should

- Compile
- Pass lint
- Pass type checking
- Match documentation
- Introduce no duplicate logic

---

# If Requirements Are Unclear

Do not guess.

Stop.

Explain the ambiguity.

Ask for clarification.

---

# Forbidden Actions

Never

❌ Change architecture.

❌ Rename APIs.

❌ Rename database tables.

❌ Rename folders.

❌ Invent undocumented features.

❌ Generate placeholder implementations.

❌ Leave TODO comments.

❌ Introduce dead code.

❌ Hardcode secrets.

❌ Commit .env files.

❌ Use `any`.

❌ Duplicate business logic.

❌ Duplicate React components.

❌ Create unnecessary abstractions.

---

# Success Criteria

Your implementation is considered successful only if

- It follows every documentation file.
- It keeps the architecture consistent.
- It minimizes complexity.
- It remains production-ready.
- Another engineer can immediately understand the code.

When uncertain,

ask before implementing.