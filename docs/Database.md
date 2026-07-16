# OpportunityPilot

# Database Design Document

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Purpose

This document defines the complete logical database design for OpportunityPilot.

It specifies:

- Database technology
- Tables
- Relationships
- Constraints
- Data ownership
- Indexing strategy

This document serves as the single source of truth for all database-related development.

---

# 2. Database Overview

Primary Database

Amazon RDS

Engine

PostgreSQL

ORM

Prisma

The frontend must never communicate directly with the database.

All database access must occur through backend services.

---

# 3. Design Principles

The database should follow the following principles:

- Third Normal Form (3NF)
- No duplicated data
- Strong referential integrity
- UUID primary keys
- Foreign key constraints
- Soft deletion where appropriate
- Indexed search columns
- Timestamp every record

---

# 4. Entity Relationship Overview

Users

│

├── Opportunities

│       │

│       ├── Recruiter Emails

│       │

│       ├── Outreach

│       │

│       └── Activity Logs

│

└── Resume

---

# 5. Table Definitions

## Users

Purpose

Stores authenticated users.

Fields

- id
- google_id
- full_name
- email
- avatar_url
- refresh_token
- access_token
- created_at
- updated_at

Constraints

- email must be unique
- google_id must be unique

Relationships

One User

↓

Many Opportunities

One User

↓

One Resume

---

## Resume

Purpose

Stores metadata for the active resume.

Fields

- id
- user_id
- file_name
- s3_object_key
- file_size
- uploaded_at
- updated_at

Relationships

One Resume

belongs to

One User

Notes

Only one active resume is supported in Version 1.

The PDF itself is stored in Amazon S3.

Only metadata is stored inside PostgreSQL.

---

## Opportunities

Purpose

Represents every hiring opportunity detected from Gmail.

Fields

- id
- user_id
- company_name
- original_email_subject
- original_email_body
- gmail_message_id
- gmail_thread_id
- detected_at
- status
- created_at
- updated_at

Relationships

One Opportunity

↓

Many Recruiter Emails

↓

One Outreach

↓

Many Activity Logs

---

## Recruiter Emails

Purpose

Stores recruiter contact information discovered for an opportunity.

Fields

- id
- opportunity_id
- recruiter_email
- confidence_score
- provider
- discovered_at

Relationships

Many Recruiter Emails

↓

One Opportunity

---

## Outreach

Purpose

Stores outgoing email information.

Fields

- id
- opportunity_id
- subject
- body
- sent_at
- attempts
- last_followup_at
- next_followup_at
- reply_received
- reply_received_at
- status

Relationships

One Outreach

belongs to

One Opportunity

---

## Activity Logs

Purpose

Maintains a timeline of important events.

Fields

- id
- opportunity_id
- event_type
- description
- created_at

Examples

Opportunity Detected

Company Extracted

Recruiter Emails Found

Email Sent

Follow-up #1

Reply Received

Status Updated

---

# 6. Relationships

User

1

↓

Many

↓

Opportunities

Opportunity

1

↓

Many

↓

Recruiter Emails

Opportunity

1

↓

One

↓

Outreach

Opportunity

1

↓

Many

↓

Activity Logs

User

1

↓

One

↓

Resume

---

# 7. Enumerations

Opportunity Status

- READY
- SENT
- WAITING_REPLY
- REPLIED
- CLOSED

---

Outreach Status

- DRAFT
- SENT
- FOLLOWUP_PENDING
- FOLLOWUP_SENT
- COMPLETED
- FAILED

---

Activity Types

- OPPORTUNITY_DETECTED
- COMPANY_EXTRACTED
- RECRUITER_DISCOVERED
- RESUME_UPLOADED
- EMAIL_SENT
- FOLLOWUP_SENT
- REPLY_RECEIVED
- STATUS_UPDATED

---

# 8. Indexing Strategy

Users

- email
- google_id

Opportunities

- company_name
- gmail_thread_id
- status

Recruiter Emails

- recruiter_email

Outreach

- next_followup_at
- status

Activity Logs

- opportunity_id
- created_at

---

# 9. Data Ownership

Users own

- Opportunities
- Resume

Opportunities own

- Recruiter Emails
- Outreach
- Activity Logs

Deleting a User should remove

- Opportunities
- Recruiter Emails
- Outreach
- Activity Logs
- Resume metadata

---

# 10. Constraints

The system shall enforce:

One active resume per user.

One outreach record per opportunity.

Every outreach must belong to one opportunity.

Every recruiter email must belong to one opportunity.

Every activity log must belong to one opportunity.

Email addresses must be unique within a single opportunity.

Attempts cannot exceed five.

reply_received defaults to false.

---

# 11. Data Lifecycle

Placement Email Received

↓

Opportunity Created

↓

Recruiter Emails Stored

↓

Resume Attached

↓

Outreach Created

↓

Activity Logged

↓

Follow-ups Updated

↓

Reply Received

↓

Status Completed

---

# 12. Backup Strategy

Amazon RDS automated backups.

Point-in-time recovery enabled.

Database snapshots before schema migrations.

---

# 13. Future Database Extensions

Future tables may include:

- Job Descriptions
- Resume Versions
- Interview Tracker
- Notifications
- User Preferences
- Chrome Extension Sync
- Analytics
- Company Profiles

Version 1 should not implement these tables.