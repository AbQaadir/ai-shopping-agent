# ============================================================
# Kapuruka AI Agent — Production Dockerfile for Railway
# Multi-stage build:  deps → builder → runner
# ============================================================

# Stage 1: Install dependencies
FROM node:20-alpine AS deps

# openssl is required by Prisma client
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 2: Build Next.js app
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Provide dummy build-time env so next build doesn't crash on missing vars.
# Real values are injected at runtime by Railway.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
ENV DIRECT_URL="postgresql://placeholder:placeholder@placeholder:5432/placeholder"
ENV GEMINI_API_KEY="placeholder"
ENV FAST_GEMINI_MODEL="gemini-2.0-flash-lite"
ENV REASONING_GEMINI_MODEL="gemini-2.5-flash"
ENV AUTO_COMPLETE_LLM="gemini-2.0-flash-lite"
ENV KAPRUKA_MCP_URL="https://mcp.kapruka.com/mcp"
ENV KAPRUKA_MCP_TIMEOUT_MS="10000"
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="placeholder"
ENV NEXT_PUBLIC_SUPABASE_URL="https://placeholder.supabase.co"
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY="placeholder"
ENV NEXT_PUBLIC_SITE_URL="https://placeholder.railway.app"

# Generate Prisma client then build Next.js (output: standalone)
RUN npx prisma generate && npm run build

# Stage 3: Minimal production runner
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway injects PORT at runtime; default to 3000 as fallback
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy only what's needed to run the standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Railway sets PORT env var; Next.js standalone server.js reads it automatically
CMD ["node", "server.js"]
