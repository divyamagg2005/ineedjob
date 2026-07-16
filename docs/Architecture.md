# OpportunityPilot

# System Architecture Document

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Purpose

This document defines the high-level system architecture of OpportunityPilot.

It describes how every component interacts, the responsibilities of each service, the overall data flow, and the boundaries between frontend, backend, external APIs, cloud services, and persistent storage.

This document serves as the architectural source of truth. All implementation must conform to this design unless an architectural decision is formally updated.

---

# 2. Architecture Principles

The system shall follow the following principles:

- Event-driven architecture
- Serverless backend where practical
- Modular service-oriented design
- Separation of concerns
- Stateless APIs
- Secure authentication
- Loose coupling between services
- High maintainability
- Scalability by design

---

# 3. High-Level Architecture

                     Gmail Inbox
                          │
                          │
                  Gmail Watch API
                          │
                          ▼
                  Google Pub/Sub
                          │
                          ▼
                AWS API Gateway
                          │
                          ▼
                   AWS Lambda
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
 Keyword Filter     Company Extractor   Hunter API
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
                  Opportunity Service
                          │
                          ▼
              Amazon RDS (PostgreSQL)
                          │
                          ▼
                Backend REST API
                          │
                          ▼
                 Next.js Dashboard
                  │              │
                  ▼              ▼
          Resume Upload     Email Editor
                  │              │
                  └──────┬───────┘
                         ▼
                   Gmail Send API
                         │
                         ▼
              Outreach Tracking Service
                         │
                         ▼
                Amazon EventBridge
                         │
                         ▼
                    AWS Lambda
                         │
                         ▼
                    Amazon SQS
                         │
                         ▼
                  Follow-up Sender

---

# 4. System Components

## Frontend

Responsibilities

- User authentication
- Dashboard
- Resume upload
- Email editor
- Opportunity management
- Analytics
- Settings

The frontend never communicates directly with the database.

All communication occurs through backend APIs.

---

## Backend API

Responsibilities

- Authentication
- Business logic
- Validation
- Database interaction
- External API integration
- Email sending
- Follow-up scheduling

The backend is the single source of truth.

---

## Gmail Integration Service

Responsibilities

- Receive Gmail Watch notifications
- Fetch Gmail messages
- Detect replies
- Send emails
- Maintain Gmail Thread IDs

---

## Company Extraction Service

Responsibilities

- Receive raw placement email
- Extract company name using LLM
- Return structured output

No other AI tasks are performed.

---

## Recruiter Discovery Service

Responsibilities

- Query Hunter API
- Retrieve recruiter email addresses
- Store discovered contacts

---

## Resume Service

Responsibilities

- Upload resume
- Replace resume
- Retrieve resume
- Store metadata

Resume files are stored in Amazon S3.

Only metadata is stored inside the database.

---

## Opportunity Service

Responsibilities

- Create opportunities
- Update status
- Retrieve dashboard data
- Store original email
- Maintain lifecycle

---

## Outreach Service

Responsibilities

- Send outreach
- Record timestamps
- Track attempts
- Maintain Gmail thread IDs

---

## Follow-up Scheduler

Responsibilities

- Daily follow-up check
- Schedule retries
- Queue email jobs
- Stop after reply
- Stop after maximum attempts

---

## Activity Logger

Responsibilities

Record every important system event.

Examples

- Opportunity detected
- Company extracted
- Recruiter discovered
- Email sent
- Follow-up sent
- Reply received

---

# 5. External Services

The system integrates with:

## Google OAuth

Purpose

User authentication.

---

## Gmail API

Purpose

- Read emails
- Send emails
- Retrieve threads

---

## Gmail Watch API

Purpose

Receive push notifications whenever Gmail receives new mail.

No polling shall be implemented.

---

## Google Pub/Sub

Purpose

Transport Gmail notifications to backend webhook.

---

## Hunter API

Purpose

Discover recruiter email addresses.

---

## Lightweight LLM API

Purpose

Extract company name from placement email.

AI shall not generate outreach emails.

---

# 6. Persistent Storage

Primary Database

Amazon RDS

Engine

PostgreSQL

Purpose

Store

- Users
- Opportunities
- Recruiter emails
- Outreach history
- Activity logs

---

File Storage

Amazon S3

Purpose

Store uploaded resumes.

Only object references shall be stored inside PostgreSQL.

---

# 7. Data Flow

Workflow 1

Placement Email

↓

Gmail Watch

↓

Pub/Sub

↓

Webhook

↓

Keyword Filter

↓

Company Extraction

↓

Hunter API

↓

Opportunity Stored

↓

Dashboard Updated

---

Workflow 2

User Uploads Resume

↓

Resume Service

↓

Amazon S3

↓

Metadata Stored

↓

Dashboard Updated

---

Workflow 3

User Sends Email

↓

Backend Validation

↓

Resume Retrieved

↓

Gmail Send API

↓

Thread ID Stored

↓

Outreach Record Created

↓

Schedule Follow-up

---

Workflow 4

Daily Scheduler

↓

Check Due Follow-ups

↓

Queue Jobs

↓

Send Follow-up

↓

Update Attempt Counter

↓

Next Follow-up Date

---

Workflow 5

Reply Received

↓

Gmail Watch

↓

Thread Lookup

↓

Reply Detected

↓

Status Updated

↓

Future Follow-ups Cancelled

---

# 8. Security

Authentication

Google OAuth 2.0

Authorization

JWT Session

Secrets

Environment Variables only.

Resume Access

Authenticated users only.

Database

No direct frontend access.

All requests must pass through backend APIs.

---

# 9. Scalability

Architecture shall support

- Multiple users
- Thousands of tracked opportunities
- Independent Lambda scaling
- Horizontal backend scaling
- Cloud-native deployment

---

# 10. Fault Tolerance

The system should recover gracefully from

- Hunter API failures
- Gmail API failures
- LLM extraction failures
- Database downtime
- Retry failures

Failed operations shall be logged.

Retry mechanisms shall be implemented where appropriate.

---

# 11. Logging

Every critical operation shall be logged.

Examples

- Login
- Email detection
- Hunter lookup
- Email sending
- Reply detection
- Follow-up execution
- Scheduler execution

Logs shall be centralized through CloudWatch.

---

# 12. Architectural Constraints

The system shall NOT

- Poll Gmail continuously
- Store resume files in PostgreSQL
- Generate outreach emails using AI
- Allow frontend access to Amazon RDS
- Skip backend validation
- Bypass authentication

---

# 13. Future Architecture Extensions

Potential future services

- LinkedIn Integration
- Resume Scoring
- AI Job Matching
- Chrome Extension
- Push Notifications
- Mobile Application
- Analytics Engine