# OpportunityPilot

# API Specification

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Purpose

This document defines every REST API exposed by OpportunityPilot.

The API serves as the only communication layer between the frontend and backend.

The frontend must never directly communicate with:

- Amazon RDS
- Amazon S3
- Gmail APIs
- Hunter API
- LLM APIs

All communication must pass through these APIs.

---

# 2. API Design Principles

The API shall follow these rules:

- RESTful design
- JSON request/response
- Stateless authentication
- Consistent naming
- Standard HTTP status codes
- Versioned endpoints
- Input validation
- Structured error responses

Base URL

/api/v1

---

# 3. Authentication APIs

## POST /auth/google

Purpose

Authenticate user using Google OAuth.

Request

Google OAuth Authorization Code

Response

- User Profile
- Session Token

Status Codes

200 Success

401 Authentication Failed

500 Server Error

---

## POST /auth/logout

Purpose

Logout current user.

Response

Success message.

Status

200

---

## GET /auth/me

Purpose

Retrieve authenticated user.

Response

User profile.

Status

200

401 Unauthorized

---

# 4. Opportunity APIs

## GET /opportunities

Purpose

Return all opportunities for the authenticated user.

Supports

- Pagination
- Search
- Sorting
- Filtering

Response

List of opportunities.

---

## GET /opportunities/{id}

Purpose

Retrieve complete opportunity details.

Includes

- Company
- Recruiter emails
- Resume
- Outreach
- Timeline

---

## DELETE /opportunities/{id}

Purpose

Delete opportunity.

Soft delete preferred.

---

# 5. Resume APIs

## POST /resume/upload

Purpose

Upload active resume.

Request

Multipart Form Data

File

PDF

Response

Resume metadata.

---

## GET /resume

Purpose

Retrieve active resume.

---

## DELETE /resume

Purpose

Remove active resume.

---

# 6. Outreach APIs

## POST /outreach/send

Purpose

Send outreach email.

Request

- Opportunity ID
- Subject
- Body

Backend automatically

- Retrieves resume
- Attaches PDF
- Sends Gmail
- Stores thread

Response

Updated outreach.

---

## GET /outreach/{id}

Purpose

Retrieve outreach details.

---

## PUT /outreach/{id}

Purpose

Update draft.

Allows

- Subject
- Body

---

# 7. Timeline APIs

## GET /timeline/{opportunityId}

Purpose

Retrieve activity timeline.

Returns

Chronological events.

---

# 8. Dashboard APIs

## GET /dashboard

Purpose

Retrieve dashboard overview.

Returns

- Statistics
- Opportunities
- Recent activity

---

## GET /dashboard/stats

Purpose

Return dashboard statistics only.

Returns

- Companies
- Emails Sent
- Replies
- Active Follow-ups
- Closed Opportunities

---

# 9. Settings APIs

## GET /settings

Purpose

Retrieve user settings.

---

## PUT /settings

Purpose

Update settings.

Supports

- Follow-up interval
- Maximum attempts
- Keywords

---

# 10. Internal APIs

These APIs are not accessible by frontend.

---

## POST /internal/gmail/webhook

Purpose

Receive Gmail Watch events.

Authentication

Google verification.

---

## POST /internal/followup/run

Purpose

Triggered by EventBridge.

Checks due follow-ups.

Queues email jobs.

---

## POST /internal/reply/process

Purpose

Process incoming Gmail replies.

Updates opportunity status.

---

# 11. Request Validation

Every endpoint shall validate

- Authentication
- Ownership
- Required fields
- Data types
- File size
- File format

Invalid requests shall never reach business logic.

---

# 12. Error Format

Every error response shall follow one format.

{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Subject is required."
    }
}

---

# 13. Success Format

Every successful response shall follow one format.

{
    "success": true,
    "data": { }
}

---

# 14. HTTP Status Codes

200 Success

201 Created

204 Deleted

400 Validation Error

401 Unauthorized

403 Forbidden

404 Not Found

409 Conflict

422 Invalid Data

429 Rate Limited

500 Internal Server Error

---

# 15. Authentication

Protected endpoints require authentication.

Authentication

Bearer Token

or

Secure Session Cookie

All requests must verify ownership.

Users may only access their own data.

---

# 16. Pagination

Large datasets shall support

- page
- limit

Response shall include

- totalRecords
- currentPage
- totalPages

---

# 17. Filtering

Supported filters

Company

Status

Attempts

Date

Reply

Search

Sorting

---

# 18. API Versioning

Current Version

v1

Future breaking changes

v2

The frontend must always call

/api/v1

---

# 19. Rate Limiting

Protect

- Authentication
- Gmail sending
- Resume upload

Repeated abuse should return

429 Too Many Requests

---

# 20. Future APIs

Version 2 may include

- LinkedIn
- Notifications
- Resume scoring
- Company analytics
- Chrome extension
- Mobile APIs