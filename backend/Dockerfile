FROM node:lts-slim

RUN apt-get update -y && apt-get install -y openssl
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Give the built-in node user ownership of /app before switching
RUN chown -R node:node /app

USER node

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

COPY --chown=node:node . .

EXPOSE 4000

CMD ["pnpm", "dev"]
