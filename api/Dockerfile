# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY api/package.json ./api/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY api/ ./api/

WORKDIR /app/api
RUN pnpm build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY api/package.json ./api/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/ ./packages/shared/
COPY --from=builder /app/api/dist/ ./api/dist/

WORKDIR /app/api

EXPOSE 3001

CMD ["node", "dist/server.js"]
