# Stage 1: Build environment
FROM node:20-slim AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

# Copy package management files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy packages
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/glass-crawler/package.json ./artifacts/glass-crawler/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/db/package.json ./lib/db/
COPY scripts/package.json ./scripts/
COPY lib/api-zod/package.json ./lib/api-zod/

# 👉 THE FIX: Added the missing mockup-sandbox package.json
COPY artifacts/mockup-sandbox/package.json ./artifacts/mockup-sandbox/

# Install dependencies
RUN pnpm install

# Copy source files
COPY . .

# Build the project
RUN pnpm run build


# Stage 2: Production environment
FROM node:20-slim AS runner

WORKDIR /app

# Install chromium dependencies missing from node-slim
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.5.0 --activate

ENV NODE_ENV=production

# Copy configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY lib/db/package.json ./lib/db/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/

# Exclude unnecessary dev packages for production runner if possible, or just install prod
RUN pnpm install --prod

# Copy compiled code
COPY --from=builder /app/artifacts/api-server/dist/ ./artifacts/api-server/dist/
COPY --from=builder /app/lib/ ./lib/
COPY --from=builder /app/node_modules ./node_modules

# Cloud run port
EXPOSE 8080
ENV PORT=8080

CMD ["node", "--max-old-space-size=150", "artifacts/api-server/dist/index.cjs"]