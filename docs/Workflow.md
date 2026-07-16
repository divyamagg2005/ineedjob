# OpportunityPilot

# Workflow Documentation

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Purpose

This document defines every business workflow in OpportunityPilot.

Each workflow describes:

- Trigger
- Preconditions
- Step-by-step execution
- Expected outcome
- Failure handling

This document defines business behavior only.

Implementation details belong elsewhere.

---

# Workflow 1

## User Authentication

### Trigger

User clicks **Sign in with Google**

### Preconditions

- User is not authenticated
- Google OAuth is configured

### Flow

User

↓

Google OAuth

↓

Permission Granted

↓

Backend receives authorization

↓

User account created (if new)

↓

Session established

↓

Dashboard opens

### Success

Authenticated user reaches dashboard.

### Failure

- OAuth cancelled
- Invalid credentials
- Token verification failure

---

# Workflow 2

## Placement Email Detection

### Trigger

A new email arrives in Gmail.

### Preconditions

- Gmail Watch API enabled
- User connected Gmail account

### Flow

Gmail receives email

↓

Watch API event generated

↓

Google Pub/Sub

↓

Webhook

↓

Backend fetches email

↓

Keyword filtering

↓

Relevant?

↓

Yes

↓

Continue

↓

No

↓

Ignore email

### Success

Relevant placement email enters processing pipeline.

### Failure

- Gmail unavailable
- Pub/Sub failure
- Webhook unavailable

---

# Workflow 3

## Company Extraction

### Trigger

Relevant placement email detected.

### Preconditions

Email passed keyword filter.

### Flow

Raw email

↓

Company Extraction Service

↓

Company name extracted

↓

Validate result

↓

Save opportunity

### Success

Opportunity contains company name.

### Failure

Extraction fails.

↓

Mark opportunity for manual review.

---

# Workflow 4

## Recruiter Discovery

### Trigger

Company successfully extracted.

### Preconditions

Valid company name exists.

### Flow

Company

↓

Hunter API

↓

Recruiter emails returned

↓

Save contacts

↓

Update dashboard

### Success

Recruiter contacts available.

### Failure

Hunter returns no contacts.

Opportunity still remains visible.

---

# Workflow 5

## Opportunity Creation

### Trigger

Company extraction completed.

### Flow

Create opportunity

↓

Store original email

↓

Store thread id

↓

Store recruiter emails

↓

Status

READY

↓

Display dashboard

### Success

New dashboard row created.

---

# Workflow 6

## Resume Upload

### Trigger

User uploads resume.

### Preconditions

Authenticated user.

### Flow

Choose PDF

↓

Validate file

↓

Upload to storage

↓

Store metadata

↓

Replace previous resume

↓

Dashboard updated

### Success

Active resume available.

### Failure

Invalid file.

Upload failure.

Storage unavailable.

---

# Workflow 7

## Email Composition

### Trigger

User selects opportunity.

### Flow

Open opportunity

↓

Load recruiter emails

↓

Load resume

↓

User writes

Subject

↓

User writes

Body

↓

Save draft

### Success

Draft ready.

---

# Workflow 8

## Send Email

### Trigger

User clicks Send.

### Preconditions

Resume uploaded.

Email subject provided.

Email body provided.

Recruiter email exists.

### Flow

Validate request

↓

Load resume

↓

Attach PDF

↓

Send Gmail

↓

Receive Thread ID

↓

Create outreach

↓

Activity log

↓

Schedule follow-up

↓

Dashboard updated

### Success

Email sent.

### Failure

Validation error.

Gmail unavailable.

Attachment error.

---

# Workflow 9

## Follow-up Scheduling

### Trigger

Initial email successfully sent.

### Flow

Attempt = 1

↓

Next follow-up

Today + 7 days

↓

Save schedule

↓

Wait

### Success

Follow-up scheduled.

---

# Workflow 10

## Daily Scheduler

### Trigger

Daily scheduler executes.

### Flow

Find pending follow-ups

↓

Due today?

↓

Yes

↓

Reply received?

↓

No

↓

Attempts < 5 ?

↓

Yes

↓

Queue follow-up

↓

Send email

↓

Increment attempts

↓

Schedule next follow-up

↓

Done

### Success

Follow-up sent.

### Failure

Retry later.

---

# Workflow 11

## Maximum Retry

### Trigger

Attempt count reaches five.

### Flow

Attempts

↓

5

↓

Status

CLOSED

↓

Cancel scheduler

↓

Stop future emails

### Success

Opportunity closed.

---

# Workflow 12

## Reply Detection

### Trigger

Gmail receives reply.

### Flow

Watch API

↓

Webhook

↓

Fetch email

↓

Read thread id

↓

Find outreach

↓

Update status

↓

Cancel follow-ups

↓

Activity log

↓

Dashboard refresh

### Success

Status

REPLIED

---

# Workflow 13

## Activity Logging

### Trigger

Any important action.

### Events

Opportunity detected

Company extracted

Recruiter discovered

Resume uploaded

Email sent

Follow-up scheduled

Follow-up sent

Reply received

Status changed

Settings updated

Login

Logout

### Success

Timeline updated.

---

# Workflow 14

## Dashboard Loading

### Trigger

Dashboard opened.

### Flow

Authenticate user

↓

Fetch opportunities

↓

Fetch analytics

↓

Fetch resume

↓

Render statistics

↓

Render table

↓

Ready

### Success

Interactive dashboard displayed.

---

# Workflow 15

## Settings Update

### Trigger

User edits settings.

### Supported Settings

- Gmail connection
- Follow-up interval
- Maximum attempts
- Keywords

### Flow

Validate settings

↓

Save

↓

Apply changes

↓

Success notification

---

# Workflow 16

## Logout

### Trigger

User clicks Logout.

### Flow

Destroy session

↓

Clear tokens

↓

Redirect login

### Success

User logged out.

---

# Global Business Rules

The system shall:

- Never send the initial email automatically.
- Never generate email content.
- Never exceed five follow-ups.
- Never send follow-ups after a reply.
- Never process irrelevant Gmail messages.
- Never expose database access to the frontend.
- Never store resume files inside PostgreSQL.
- Always preserve Gmail thread IDs.
- Always record important activity.
- Always validate user ownership before data access.

---

# Future Workflows (Version 2)

- LinkedIn enrichment
- Resume scoring
- Company insights
- Interview scheduling
- Push notifications
- Chrome extension
- AI opportunity ranking