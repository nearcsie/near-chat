# Stage 1: Install dependencies
FROM node:lts-slim AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace

COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/

WORKDIR /workspace/frontend
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Stage 2: Build the frontend
FROM node:lts-slim AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace

# Copy global configs and shared files
COPY tsconfig.base.json ./
COPY shared/ ./shared/

# Copy frontend node_modules from deps stage and source code
COPY --from=deps /workspace/frontend/node_modules ./frontend/node_modules
COPY frontend/ ./frontend/

WORKDIR /workspace/frontend
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# Stage 3: Production runner (minimal image)
FROM node:lts-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Give the built-in node user ownership of /app before switching
RUN chown -R node:node /app

USER node

# Copy standalone server, static assets, and public files
COPY --from=builder --chown=node:node /workspace/frontend/.next/standalone ./
COPY --from=builder --chown=node:node /workspace/frontend/.next/static ./.next/static
COPY --from=builder --chown=node:node /workspace/frontend/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
