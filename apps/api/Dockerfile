# syntax=docker/dockerfile:1

# -----------------------------
# CollabHub - Production Dockerfile (Backend)
# Uses npm INSIDE Docker to avoid pnpm workspace store/symlink issues.
# -----------------------------

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install backend dependencies first (better layer caching)
COPY apps/api/package.json ./
RUN npm install

# Copy the rest of the backend source, then generate Prisma + build TS
COPY apps/api/ ./

RUN npx prisma generate
RUN npx tsc

# ---------------- Production runner ----------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Prisma CLI needs OpenSSL at runtime on Alpine
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json

# Writable uploads folder
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 4000
ENV PORT=4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]