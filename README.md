# Real-Time Messaging System

English | [繁體中文](README.zh-TW.md)

A real-time group chat application built as an NTNU Database Theories course project. This monorepo features a Next.js frontend, a Node.js/Express backend API using raw SQL query pools, and a PostgreSQL database orchestrating custom permissions, chat folders, message lifecycle triggers, and emergency contact alerts.

---

## Table of Contents

- [Key Features](#key-features)
- [Database & Architecture](#database--architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Testing](#testing)

---

## Key Features

1. **Real-time Messaging & Status**: Seamless private and group messaging powered by Socket.IO with dynamic online status indicators.
2. **Granular Chat Room Permissions**:
   - Customizable user roles (`owner`, `admin`, `member`, `pending`).
   - Mute control (`is_muted`), room-specific custom user nicknames, and approval workflows (`require_approval`).
   - Selective history visibility for new members (`view_history`).
3. **Emergency Auto-Contact / "Last Words" Mode**: 
   - Uses scheduler rules checking users' `last_activity`.
   - When a user goes offline exceeding `warning_days`, pre-defined emergency messages are dispatched automatically to emergency contacts.
4. **Chat Folder Categorization**: Users can organize multiple chat rooms into customizable directories (`folders` and `folder_rooms`).
5. **Message Lifecycle & Actions**: Supports replying to messages (`reply_to_id`), message recalls (`is_recalled`), attachments, and soft deletes (`deleted_at`).

## Database & Architecture

### Entity-Relationship (ER) Diagram

The system relies on PostgreSQL 18 to handle complex relationships and cascading deletes. Below is the comprehensive ER diagram representing the database layout:

```mermaid
erDiagram
    users {
        uuid user_id PK
        varchar name
        varchar email
        char password_hash
        text bio
        varchar avatar_url
        boolean warning_enabled
        int warning_days
        timestamp last_activity
        timestamp created_at
        timestamp deleted_at
        varchar lang_preference
        varchar app_theme
        boolean notify_desktop
        boolean notify_sound
    }

    chat_rooms {
        uuid room_id PK
        varchar type
        varchar name
        varchar avatar_url
        varchar invite_code
        boolean require_approval
        boolean view_history
        boolean is_archived
        timestamp created_at
    }

    messages {
        uuid message_id PK
        uuid room_id FK
        uuid sender_id FK
        text content
        uuid reply_to_id FK
        boolean is_recalled
        timestamp sent_at
    }

    attachments {
        uuid attachment_id PK
        uuid message_id FK
        uuid uploaded_by FK
        varchar file_path
        varchar file_type
        varchar original_name
        timestamp uploaded_at
    }

    room_members {
        uuid room_id PK, FK
        uuid user_id PK, FK
        varchar role
        varchar nickname
        boolean is_muted
        uuid last_read_id FK
        timestamp join_time
    }

    friendships {
        uuid requester_id PK, FK
        uuid addressee_id PK, FK
        varchar status
        timestamp created_at
    }

    blocks {
        uuid blocker_id PK, FK
        uuid blocked_id PK, FK
        timestamp created_at
    }

    folders {
        uuid folder_id PK
        uuid user_id FK
        varchar name
        timestamp created_at
    }

    folder_rooms {
        uuid folder_id PK, FK
        uuid room_id PK, FK
        uuid user_id FK
    }

    emergency_contacts {
        uuid user_id PK, FK
        uuid contact_id PK, FK
        text message
        timestamp created_at
    }

    message_mentions {
        uuid message_id PK, FK
        uuid user_id PK, FK
    }

    users ||--o{ friendships : "requests / receives"
    users ||--o{ blocks : "blocks / is blocked"
    users ||--o{ folders : "owns"
    users ||--o{ room_members : "joins"
    users ||--o{ messages : "sends"
    users ||--o{ attachments : "uploads"
    users ||--o{ emergency_contacts : "delegates / listed"
    users ||--o{ message_mentions : "mentioned"
    
    chat_rooms ||--o{ room_members : "contains"
    chat_rooms ||--o{ messages : "contains"
    chat_rooms ||--o{ folder_rooms : "categorized under"

    folders ||--o{ folder_rooms : "contains"

    messages ||--o{ attachments : "includes"
    messages |o--o| messages : "replies to"
    messages ||--o{ message_mentions : "has mentions"
```

For the detailed database schema layout and foreign keys, refer to [Relation Schema Guide](docs/relation-schema.md) and [ER Diagram Details](docs/er_diagram.md).

### Backend Layered Architecture

To keep the codebase maintainable and scalable, the backend implements a strict 4-layer architecture:

```mermaid
flowchart LR
    Client([HTTP / WebSocket Client]) --> Routes[1. Routes & Middleware]
    Routes --> Controllers[2. Controllers]
    Controllers --> Services[3. Services]
    Services --> Repositories[4. Repositories]
    Repositories --> DB[(PostgreSQL 18)]
```

1. **Routes (Route Layer)**: 
   Defines API endpoints and mounts middlewares for request validation, rate limiting, and JWT authentication.
2. **Controllers (Control Layer)**:
   Extracts inputs from requests (`params`, `query`, `body`), passes them to the Service layer, and returns standardized HTTP responses.
3. **Services (Service Layer)**:
   Implements business logic (e.g. permission checks, validation rules, business invariants) without being coupled to Express or SQL.
4. **Repositories (Data Access Layer)**:
   Communicates directly with the database using raw SQL queries with parameterised placeholders via the `pg` driver.

For details on this structure, refer to the development blueprint in [PLAN.md](PLAN.md).

## Tech Stack

- **Frontend**: Next.js 16.2 (App Router), React 19, Tailwind CSS v4, Socket.IO Client.
- **Backend**: Node.js, Express v5, Socket.IO, `pg` (PostgreSQL raw client).
- **Database**: PostgreSQL 18.
- **Orchestration**: Docker & Docker Compose.
- **Package Manager**: pnpm.

## Project Structure

```text
.
├── backend/                # Express API backend
│   ├── src/                # Backend TypeScript source code (routes, controllers, services, repositories)
│   ├── migrations/         # PostgreSQL node-pg-migrate schema migrations
│   └── Dockerfile          # Backend container configurations
├── frontend/               # Next.js frontend web app
│   ├── app/                # React App Router pages and layouts
│   ├── components/         # Reusable styling & UI components
│   └── Dockerfile          # Frontend container configurations
├── shared/                 # Shared TypeScript models and types (mounted read-only)
├── docs/                   # Full documentation (DESIGN, DEVELOPMENT, TESTING, APIs)
├── docker-compose.yml      # Local multi-container development orchestration
└── README.md               # Overview and orientation index
```

## Getting Started

Detailed configuration guides can be found in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

### 1. Copy Environment Settings
Copy the development environment example file (the defaults work out of the box):
```bash
cp .env.example .env
```

### 2. Boot Services
Build and run the containers using Docker Compose:
```bash
docker compose up -d
```
The backend container automatically runs all pending database migrations on startup before the dev server launches.

### 3. Seed Mock Data
Populate the database with pre-configured test users:
```bash
docker compose exec backend pnpm run db:seed
```
*Note: The seed script resets your database and generates 6 pre-configured users (e.g. `alice@test.com`, password: `password123`) for testing.*

### 4. Port Access Table

| Service | Address | Description |
| :--- | :--- | :--- |
| **Frontend App** | [http://localhost:3005](http://localhost:3005) | Main Next.js web application |
| **Backend API** | [http://localhost:4005](http://localhost:4005) | Express API & Socket.IO server |
| **PostgreSQL Database** | `localhost:5435` | PostgreSQL 18 instance (Mapped from internal port `5432`) |

---

## Testing

Ensure your containers are healthy, then trigger the test suites:

```bash
# Unit Tests (TypeScript compilation & mocked tests)
docker compose exec backend pnpm run test:unit

# Integration Tests (Launches ephemeral test DB from docker-compose.test.yml)
docker compose exec backend pnpm run test:db:up
docker compose exec backend pnpm run test:integration
```
For more testing details, see [docs/TESTING.md](docs/TESTING.md).
