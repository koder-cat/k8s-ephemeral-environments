# Stage 1: Install ALL dependencies (for building)
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install all dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Stage 1b: Production dependencies only
FROM node:22-alpine AS prod-deps

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Install production dependencies only (no devDependencies)
RUN pnpm install --frozen-lockfile --prod

# Stage 2: Build the applications
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy workspace config
COPY package.json pnpm-workspace.yaml ./

# Copy source code selectively for better layer caching
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json apps/api/nest-cli.json ./apps/api/
COPY apps/api/package.json ./apps/api/
COPY apps/web/src ./apps/web/src
COPY apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html ./apps/web/
COPY apps/web/package.json ./apps/web/

# Build web first (outputs to apps/web/dist)
RUN pnpm --filter @demo-app/web build

# Build API (outputs to apps/api/dist)
RUN pnpm --filter @demo-app/api build

# Copy web build to API public folder
RUN mkdir -p apps/api/dist/public && \
    cp -r apps/web/dist/* apps/api/dist/public/

# Stage 3: Production image
FROM node:22-alpine AS runner

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy production-only node_modules from prod-deps stage
# pnpm hoists common deps to root, so we need both locations
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules

# Copy built application (includes public folder with web assets)
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main"]
