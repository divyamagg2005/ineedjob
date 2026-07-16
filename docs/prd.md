# OpportunityPilot

## Product Requirements Document (PRD)

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Overview

OpportunityPilot is a web application that helps students automate internship and job outreach after receiving placement-related emails.

The platform automatically detects hiring notifications from the user's Gmail inbox, extracts the hiring company, discovers recruiter contact information, and presents everything in a centralized dashboard where users can manually send personalized outreach emails with their resume attached.

After an email is sent, the platform automatically schedules follow-up emails until either a reply is received or the maximum number of follow-up attempts has been reached.

The application is designed to reduce repetitive work while ensuring the user remains fully in control of all communication.

---

# 2. Problem Statement

Students frequently receive hiring notifications through university email systems.

For every opportunity they must manually:

- Read the placement email
- Identify the hiring company
- Search recruiter contact information
- Upload their resume
- Write a personalized outreach email
- Send the email
- Track responses
- Remember follow-ups

This process is repetitive, time-consuming, and often leads to missed opportunities.

---

# 3. Product Vision

Build a centralized outreach platform that converts hiring emails into actionable opportunities while automating repetitive tasks without removing user control.

The system should reduce manual effort while maintaining personalized communication.

---

# 4. Goals

The platform shall:

- Detect placement emails automatically
- Identify hiring companies
- Discover recruiter email addresses
- Display opportunities in a centralized dashboard
- Allow users to manually compose outreach emails
- Attach resumes to outgoing emails
- Track outreach history
- Schedule automatic follow-ups
- Stop follow-ups after a reply
- Maintain a complete activity history

---

# 5. Target Users

Primary Users

- University students
- Internship seekers
- Final-year engineering students
- Campus placement participants

Secondary Users

- Fresh graduates
- Job seekers

---

# 6. User Stories

As a student,

I want hiring emails to be detected automatically

so that I never miss opportunities.

---

As a student,

I want recruiter emails to be discovered automatically

so that I don't spend time searching online.

---

As a student,

I want all opportunities displayed in one dashboard

so that I can manage my applications efficiently.

---

As a student,

I want to write my own outreach email

so that every application remains personalized.

---

As a student,

I want follow-ups to happen automatically

so I don't forget to reconnect with recruiters.

---

As a student,

I want replies to stop future follow-ups

so recruiters aren't spammed.

---

# 7. Functional Requirements

The system shall:

### Authentication

- Allow users to sign in using Google.
- Request permission to access Gmail.

---

### Opportunity Detection

- Detect placement-related emails.
- Ignore unrelated emails.

---

### Company Identification

- Extract the hiring company from the received email.

---

### Recruiter Discovery

- Retrieve recruiter contact information for detected companies.

---

### Dashboard

Display

- Company
- Recruiter contacts
- Resume
- Email draft
- Outreach status
- Follow-up progress
- Activity history

---

### Resume Management

Users shall be able to

- Upload
- Replace
- Manage one active resume

---

### Outreach

Users shall

- Write email subject
- Write email body
- Send outreach

The system shall attach the active resume automatically.

---

### Follow-ups

The system shall

- Schedule follow-ups
- Retry weekly
- Stop after five attempts
- Stop immediately after receiving a reply

---

### Reply Tracking

The system shall

- Detect recruiter replies
- Update dashboard status
- Record timeline events

---

# 8. Non-Functional Requirements

The application should

- Support multiple users
- Be responsive
- Be scalable
- Be secure
- Protect user credentials
- Process events in near real time
- Maintain complete audit history
- Support future feature expansion

---

# 9. Constraints

The application must not

- Generate email content using AI
- Send emails automatically without user approval
- Contact recruiters after five unanswered attempts
- Continue follow-ups after a reply

---

# 10. MVP Scope

Version 1 includes

- Google Sign-In
- Gmail integration
- Hiring email detection
- Company extraction
- Recruiter discovery
- Dashboard
- Resume upload
- Manual email composition
- Resume attachment
- Outreach tracking
- Automatic follow-ups
- Reply detection
- Analytics dashboard

---

# 11. Out of Scope

Version 1 will not include

- Resume optimization
- Job recommendation AI
- Interview scheduling
- LinkedIn integration
- Chrome extension
- Team collaboration
- Mobile application

---

# 12. Success Metrics

The MVP will be considered successful if users can

- Detect hiring emails automatically
- Send outreach in under two minutes
- Never miss scheduled follow-ups
- Track every opportunity from one dashboard