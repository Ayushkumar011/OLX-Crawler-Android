# Stage 1: Build environment
FROM node:20-alpine AS builder

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
FROM node:20-alpine AS runner

WORKDIR /app

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
COPY --from=builder /app/artifacts/api-server/build/ ./artifacts/api-server/build/
COPY --from=builder /app/lib/ ./lib/
COPY --from=builder /app/node_modules ./node_modules

# Cloud run port
EXPOSE 8080
ENV PORT=8080

CMD ["node", "artifacts/api-server/build/index.js"]