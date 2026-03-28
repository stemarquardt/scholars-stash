# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder
WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable

# Copy workspace manifests first — better layer caching on dep changes
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./

# Copy only the packages the API server and frontend need
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/homeschool-hub/ ./artifacts/homeschool-hub/

# Install all dependencies (pnpm skips incompatible optional platform binaries)
RUN pnpm install --frozen-lockfile

# Build frontend (outputs to artifacts/homeschool-hub/dist/public)
RUN pnpm --filter @workspace/homeschool-hub build

# Build API server (esbuild bundles everything into dist/index.mjs)
RUN pnpm --filter @workspace/api-server build

# ── Stage 2: Production image ─────────────────────────────────────────────────
# esbuild bundled every workspace package into dist/index.mjs so we don't need
# node_modules at runtime. The final image is just Node + the built files.
FROM node:24-alpine AS production
WORKDIR /app

# Copy the bundled API server
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Copy built frontend static files
COPY --from=builder /app/artifacts/homeschool-hub/dist/public ./public

# Where the Express static middleware will look for files
ENV STATIC_FILES_PATH=/app/public
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
