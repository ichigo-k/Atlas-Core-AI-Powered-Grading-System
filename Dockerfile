# syntax=docker/dockerfile:1

# ═══════════════════════════════════════════════════════════════════════════════
# ai-powered-grading-system — Next.js Exam Portal
# Multi-stage build optimized for minimal production image.
# Uses pnpm for dependency management and Next.js standalone output.
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependency manifests — layer is cached unless these change.
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies needed for build).
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Pull node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client (needs the schema, not a DB connection)
RUN pnpm prisma generate

# Build Next.js in standalone mode.
# The build needs DATABASE_URL for Prisma schema validation but doesn't connect.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm build

# ── Stage 3: Production runtime ─────────────────────────────────────────────
FROM node:22-alpine AS runner

# Security: run as non-root
RUN addgroup --system --gid 1001 nextjs \
    && adduser --system --uid 1001 nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Hostname binding — Next.js standalone server needs this
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Copy standalone output (includes server.js and minimal node_modules)
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
# Copy static assets
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
# Copy public assets
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
# Copy Prisma schema + migrations (needed for `prisma migrate deploy` at startup)
COPY --from=builder --chown=nextjs:nextjs /app/prisma ./prisma
# Copy Prisma client (generated in node_modules)
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nextjs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Install prisma CLI for running migrations at container startup
RUN npm install -g prisma@latest

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start: run pending migrations then launch the server.
# In production, you may want to run migrations as a separate init container
# instead. Remove the prisma migrate line if you prefer that approach.
CMD ["sh", "-c", "prisma migrate deploy --schema=./prisma/schema.prisma && node server.js"]
