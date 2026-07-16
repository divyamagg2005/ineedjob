# OpportunityPilot

# User Interface & User Experience Specification

Version: 1.0

Author: Pranshu Ranjan

Status: Draft

---

# 1. Purpose

This document defines the complete frontend experience of OpportunityPilot.

It specifies:

- Navigation
- Pages
- Components
- Layouts
- Tables
- Forms
- Dialogs
- Drawers
- Empty states
- Loading states
- Responsive behavior

This document serves as the source of truth for all frontend development.

---

# 2. Design Philosophy

The interface should feel like a professional CRM dashboard.

Primary goals

- Clean
- Minimal
- Fast
- Information dense
- Easy to scan
- Responsive

The UI should prioritize productivity over visual decoration.

---

# 3. Design System

Framework

- TailwindCSS

Components

- shadcn/ui

Icons

- Lucide React

Tables

- TanStack Table

Charts

- Recharts

Forms

- React Hook Form

Validation

- Zod

---

# 4. Theme

Primary Color

Blue

Success

Green

Warning

Amber

Error

Red

Background

Light Gray

Cards

White

Border Radius

Medium

Shadows

Minimal

Animations

Subtle only

---

# 5. Navigation

Desktop

Left Sidebar

Top Navbar

Content Area

Mobile

Collapsible Sidebar

Bottom Navigation (optional future)

---

# 6. Sidebar

Items

Dashboard

Resume

Settings

Profile

Logout

Future

Analytics

Notifications

---

# 7. Top Navigation

Contains

Application Logo

Search Bar

Theme Toggle

User Avatar

Notification Indicator

---

# 8. Dashboard Layout

--------------------------------

Top Statistics

--------------------------------

Search + Filters

--------------------------------

Opportunity Table

--------------------------------

Details Drawer

--------------------------------

---

# 9. Dashboard Statistics

Cards

Companies Found

Emails Sent

Replies Received

Active Follow-ups

Closed Opportunities

Each card contains

Title

Value

Icon

Small trend indicator (future)

---

# 10. Opportunity Table

Columns

Company

Recruiter Emails

Resume

Email Subject

Attempts

Last Sent

Next Follow-up

Status

Actions

Actions

Send

View

Edit

Delete

Table Features

Pagination

Sorting

Filtering

Column Resize

Sticky Header

Search

---

# 11. Search & Filters

Search

Company Name

Filters

Status

Attempts

Reply Status

Date

Sorting

Newest

Oldest

Company Name

---

# 12. Status Badges

READY

Gray

SENT

Blue

WAITING

Orange

REPLIED

Green

CLOSED

Red

---

# 13. Opportunity Details Drawer

Opens from the right.

Sections

Company Information

↓

Recruiter Emails

↓

Original Placement Email

↓

Resume

↓

Email Subject

↓

Email Body

↓

Timeline

↓

Send Button

---

# 14. Email Editor

Fields

Subject

Multiline Body

Buttons

Save Draft

Send Email

Discard

Character counter optional.

---

# 15. Resume Page

Displays

Current Resume

Upload Date

File Size

Buttons

Upload

Replace

Delete

Only one active resume allowed.

---

# 16. Timeline Component

Vertical timeline.

Events

Opportunity Detected

Company Extracted

Recruiter Emails Found

Resume Uploaded

Email Sent

Follow-up Sent

Reply Received

Completed

Newest events displayed first.

---

# 17. Settings Page

Sections

Google Account

↓

Follow-up Settings

↓

Keyword Detection

↓

Danger Zone

---

# 18. Profile Page

Displays

Avatar

Name

Email

Connected Gmail

Member Since

---

# 19. Dialogs

Confirmation Dialog

Delete Opportunity

Replace Resume

Disconnect Gmail

Logout

---

# 20. Toast Notifications

Success

Resume uploaded.

Email sent.

Settings updated.

Error

Upload failed.

Email failed.

Authentication failed.

---

# 21. Loading States

Dashboard

Skeleton Loader

Opportunity Table

Skeleton Rows

Resume

Progress Bar

Buttons

Loading Spinner

---

# 22. Empty States

No Opportunities

"No hiring opportunities found."

No Resume

"Upload your resume to begin."

No Recruiter Emails

"No recruiter emails discovered."

No Activity

"No events available."

---

# 23. Error States

Network Error

Retry Button

API Failure

Friendly message

Authentication Expired

Redirect to Login

---

# 24. Responsive Design

Desktop

Full Layout

Tablet

Collapsible Sidebar

Mobile

Responsive Table

Drawer becomes Full Screen

Buttons become Full Width

---

# 25. Accessibility

Keyboard Navigation

Screen Reader Labels

High Contrast Support

Visible Focus States

Proper Semantic HTML

---

# 26. Future UI Features

Dark Mode

Company Logos

Charts

Email Templates

Kanban View

Calendar View

Drag & Drop

Notifications Panel

Multi Resume Manager

---

# 27. UI Rules

The application shall

- Never hide important actions
- Keep primary actions visible
- Keep navigation consistent
- Keep spacing uniform
- Never overload dialogs
- Prefer drawers over new pages
- Prefer tables over cards
- Minimize clicks
- Always show status visually
- Always confirm destructive actions

---

# 28. Component Hierarchy

App

↓

Sidebar

↓

Top Navigation

↓

Dashboard

↓

Statistics Cards

↓

Search Bar

↓

Filters

↓

Opportunity Table

↓

Opportunity Drawer

↓

Timeline

↓

Dialogs

↓

Toast Notifications

---

# 29. Design Constraints

Do not redesign layouts without updating this document.

Do not replace tables with cards.

Do not replace drawers with pages.

Do not introduce additional navigation levels.

Maintain a clean enterprise dashboard appearance throughout the application.