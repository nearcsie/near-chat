# Stage 1: Install dependencies
FROM node:lts-slim AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace

# Copy global configs and shared files
COPY tsconfig.base.json ./
COPY shared/ ./shared/

# Copy frontend packages
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
WORKDIR /workspace/frontend
RUN pnpm install --no-frozen-lockfile --ignore-scripts

# Stage 2: Build the frontend
FROM node:lts-slim AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /workspace

# Copy global configs and shared files
COPY tsconfig.base.json ./
COPY shared/ ./shared/

# Copy frontend packages and node_modules
COPY --from=deps /workspace/frontend/node_modules ./frontend/node_modules
COPY frontend/ ./frontend/
WORKDIR /workspace/frontend
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm build

# Stage 3: Runner
FROM node:lts-slim AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set correct permissions
RUN mkdir -p .next && chown -R nextjs:nodejs /app

# Leverage standalone output
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /workspace/frontend/public ./public

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
