# syntax=docker/dockerfile:1.7

# ---- install deps ----
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ---- runtime ----
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    WORKSPACE_DIR=/workspace

# Copy production deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock tsconfig.json ./
COPY src ./src

# Prepare workspace dir (mount your workspace volume here at runtime)
RUN mkdir -p /workspace && \
    chown -R bun:bun /app /workspace

USER bun

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
