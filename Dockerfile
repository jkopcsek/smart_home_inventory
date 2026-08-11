# Home Assistant add-on image for Smart Home Inventory.
# Build context = repo root (this file lives next to config.yaml).
#
# Prisma 7: the TypeScript client is generated into libs/prisma/src/generated
# and checked in — no engine binaries, no generate step in the image. The only
# native piece is better-sqlite3 (ships musl prebuilds; build tools are
# installed temporarily as a fallback).

# ---- build stage -----------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /workspace

COPY package.json package-lock.json ./
# fetch-* flags: under QEMU (cross-arch CI builds), npm's own crypto/TLS work
# runs slow enough that registry requests can trip the default timeout/retry
# budget outright — widen it rather than let a slow emulated CPU fail the build.
RUN apk add --no-cache --virtual .build python3 make g++ \
  && npm ci --fetch-retries=8 --fetch-retry-mintimeout=30000 --fetch-retry-maxtimeout=180000 --fetch-timeout=900000 \
  && apk del .build

COPY nx.json tsconfig.base.json jest.preset.js eslint.config.mjs prisma.config.ts ./
COPY apps ./apps
COPY libs ./libs

RUN npx nx build backend --configuration=production --skip-nx-cache \
  && npx nx build frontend --configuration=production --skip-nx-cache

# ---- runtime stage ---------------------------------------------------------
FROM node:24-alpine
WORKDIR /app

ENV NODE_ENV=production \
    DATA_DIR=/data \
    STATIC_DIR=/app/public \
    PORT=8099

COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build python3 make g++ \
  && npm ci --omit=dev --fetch-retries=8 --fetch-retry-mintimeout=30000 --fetch-retry-maxtimeout=180000 --fetch-timeout=900000 \
  && apk del .build \
  && npm cache clean --force

# Prisma config + schema + migrations (for `prisma migrate deploy` at startup)
COPY prisma.config.ts ./
COPY libs/prisma/prisma ./libs/prisma/prisma

# Compiled backend + built frontend
COPY --from=build /workspace/dist/apps/backend ./
COPY --from=build /workspace/dist/apps/frontend/browser ./public

EXPOSE 8099
CMD ["sh", "-c", "npx prisma migrate deploy && node /app/main.js"]
