# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy monorepo root manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/plugin-sdk/package.json ./packages/plugin-sdk/
COPY web/package.json ./web/

# Install all workspace deps
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/plugin-sdk/ ./packages/plugin-sdk/
COPY web/ ./web/

# Build
WORKDIR /app/web
RUN pnpm build

# ── Stage 2: serve with nginx ─────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/web/dist /usr/share/nginx/html

# Nginx config: proxy /api → api:3001, /osint → osint:8001, SPA fallback
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
