# OpportunityPilot

# AWS Infrastructure Specification

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Purpose

This document defines the cloud infrastructure used by OpportunityPilot.

It specifies:

- AWS services
- Service responsibilities
- Deployment architecture
- Networking
- Security
- Storage
- Compute
- Monitoring
- Scaling

This document is the single source of truth for infrastructure decisions.

---

# 2. Infrastructure Philosophy

The infrastructure should follow these principles:

- Serverless first
- Event-driven
- Cost efficient
- Scalable
- Highly available
- Secure by default
- Easy to maintain

Infrastructure should remain simple unless scaling requirements demand additional complexity.

---

# 3. AWS Services

The application uses the following AWS services.

## Compute

AWS Lambda

Purpose

- Gmail Webhook Processing
- Company Extraction
- Hunter API Integration
- Reply Detection
- Follow-up Processing

---

## API Layer

Amazon API Gateway

Purpose

Expose secure REST endpoints.

Responsibilities

- Authentication
- Request validation
- Route requests
- Trigger Lambda

---

## Database

Amazon RDS

Engine

PostgreSQL

Purpose

Persistent relational storage.

Stores

- Users
- Opportunities
- Recruiter Emails
- Applications
- Activity Logs
- Settings

---

## File Storage

Amazon S3

Purpose

Store user resumes.

Bucket Structure

/resumes/{userId}/resume.pdf

Only metadata is stored inside PostgreSQL.

---

## Event Scheduling

Amazon EventBridge

Purpose

Runs scheduled jobs.

Responsibilities

Daily Follow-up Scan

Future Notification Jobs

---

## Queue

Amazon SQS

Purpose

Queue follow-up emails.

Responsibilities

- Prevent spikes
- Retry failed jobs
- Decouple scheduler from sender

---

## Monitoring

Amazon CloudWatch

Purpose

Logs

Metrics

Errors

Execution history

Performance monitoring

---

## Secrets

AWS Secrets Manager

Purpose

Securely store

- Hunter API Key
- LLM API Key
- Database Credentials
- Google OAuth Credentials

Secrets must never be committed to Git.

---

# 4. External Services

Google OAuth

Purpose

Authentication

---

Gmail API

Purpose

Read emails

Send emails

Retrieve thread information

---

Gmail Watch API

Purpose

Push notifications

No polling allowed.

---

Google Pub/Sub

Purpose

Forward Gmail events to backend.

---

Hunter API

Purpose

Recruiter discovery.

---

LLM API

Purpose

Extract company names.

No other AI tasks permitted.

---

# 5. Infrastructure Architecture

                    Gmail
                      │
               Watch API
                      │
               Google Pub/Sub
                      │
                      ▼
               API Gateway
                      │
                      ▼
                  Lambda
                      │
      ┌───────────────┼───────────────┐
      ▼               ▼               ▼
 Keyword Filter   Company AI    Hunter API
      │               │               │
      └───────────────┼───────────────┘
                      ▼
              Amazon RDS
                      │
                      ▼
              REST Backend
                      │
                      ▼
            Next.js Dashboard

Resume Upload

↓

Amazon S3

Email Send

↓

Gmail API

Daily Scheduler

↓

EventBridge

↓

Lambda

↓

SQS

↓

Lambda

↓

Gmail API

---

# 6. Lambda Functions

Function

gmailWebhookHandler

Purpose

Receive Gmail notifications.

---

Function

processPlacementEmail

Purpose

Keyword filtering

Company extraction

Hunter lookup

Database update

---

Function

replyDetectionHandler

Purpose

Process Gmail replies.

---

Function

dailyFollowupScheduler

Purpose

Find pending follow-ups.

---

Function

sendFollowupEmail

Purpose

Send queued follow-up emails.

---

# 7. API Gateway Routes

/auth

/opportunities

/resume

/outreach

/settings

/dashboard

/internal

---

# 8. Amazon S3

Bucket

opportunitypilot-resumes

Folder Structure

/resumes/

/resumes/{userId}

/resumes/{userId}/resume.pdf

Rules

Private bucket

No public access

Versioning enabled

Encryption enabled

---

# 9. Amazon RDS

Engine

PostgreSQL

Storage

Auto Scaling Enabled

Automatic Backups

Enabled

Multi-AZ

Optional

Encryption

Enabled

---

# 10. EventBridge

Schedule

Runs once daily.

Responsibilities

Check follow-ups.

Queue emails.

Generate logs.

Future

Notification scheduling.

---

# 11. SQS

Queue Name

followup-email-queue

Dead Letter Queue

Enabled

Maximum Retry

Configured

Messages

One follow-up email per message.

---

# 12. Security

Authentication

Google OAuth

Authorization

JWT

Database

Private

S3

Private

Secrets

Secrets Manager

HTTPS

Required

IAM

Least privilege principle.

---

# 13. IAM Roles

Lambda

- Read Secrets
- Read/Write RDS
- Read/Write S3
- Publish CloudWatch Logs

API Gateway

Invoke Lambda

EventBridge

Invoke Scheduler Lambda

SQS

Invoke Sender Lambda

---

# 14. Monitoring

CloudWatch Logs

Track

Authentication

Webhook events

Hunter requests

Email sending

Scheduler execution

Reply detection

Errors

Warnings

---

# 15. Environment Variables

GOOGLE_CLIENT_ID

GOOGLE_CLIENT_SECRET

DATABASE_URL

JWT_SECRET

AWS_REGION

AWS_BUCKET_NAME

HUNTER_API_KEY

LLM_API_KEY

GMAIL_WEBHOOK_TOPIC

---

# 16. Deployment

Frontend

Vercel

or

AWS Amplify

Backend

AWS Lambda

Database

Amazon RDS

Storage

Amazon S3

Monitoring

CloudWatch

---

# 17. Scaling Strategy

Stateless APIs

Independent Lambda scaling

RDS auto scaling

SQS decoupling

CloudWatch monitoring

Infrastructure must support thousands of opportunities without architectural changes.

---

# 18. Disaster Recovery

Automatic RDS Backups

S3 Versioning

CloudWatch Logs

Retry failed queues

Dead Letter Queue

Point-in-Time Recovery

---

# 19. Cost Optimization

Serverless compute

Event-driven execution

No idle servers

S3 Standard storage

RDS autoscaling

No unnecessary services

---

# 20. Future Infrastructure

CloudFront

Redis Cache

OpenSearch

SNS Notifications

Step Functions

ECS Migration

CI/CD Pipeline

Multi-region deployment