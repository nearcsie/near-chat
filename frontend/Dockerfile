FROM node:lts-slim

# Stage 2: Build the frontend
FROM node:lts-slim AS builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy global configs and shared files
COPY tsconfig.base.json ./
COPY shared/ ./shared/

# Copy frontend packages and node_modules
COPY --from=deps /workspace/frontend/node_modules ./frontend/node_modules
COPY frontend/ ./frontend/
WORKDIR /workspace/frontend
ENV NEXT_TELEMETRY_DISABLED=1

# Pass API URL at build time for Next.js to inline into client bundles
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm build

# Stage 3: Runner
FROM node:lts-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Give the built-in node user ownership of /app before switching
RUN chown -R node:node /app

USER node

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY --chown=node:node . .

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

