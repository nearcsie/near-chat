# Real-Time Messaging System

This project is the final project for Database Theories.

## Project Goals
1. Support direct messages and group chat.
2. Provide highly customizable group permission management.
3. Offer chat folder organization to keep conversations tidy.
4. Support auto-contact and emergency status reporting, including alerts to emergency contacts when a user has been offline for several days.

## Tech Stack
- Frontend: Next.js, Tailwind CSS, Socket.io client
- Backend: Node.js, Express, Socket.io
- Database: PostgreSQL 18
- Containerization: Docker, Docker Compose
- Package manager: pnpm

## Project Structure

```text
.
├── backend/                # Backend service
│   ├── Dockerfile          # Backend container image
│   ├── package.json        # Backend scripts and dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   ├── migrations/         # Database migration files
│   └── src/                # Backend source code
├── frontend/               # Frontend application
│   ├── Dockerfile          # Frontend container image
│   ├── package.json        # Frontend scripts and dependencies
│   ├── tsconfig.json       # TypeScript configuration
│   ├── next.config.ts      # Next.js configuration
│   ├── app/                # App Router pages and layouts
│   ├── components/         # Reusable UI components
│   ├── lib/                # Shared utilities
│   └── public/             # Static assets
├── docs/                   # Project documentation
├── docker-compose.yml      # Local development services
└── README.md               # Project overview
```

## Development Guide
See [DEVELOPMENT.md](docs/DEVELOPMENT.md)