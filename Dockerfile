# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source code and build project
COPY . .
RUN npm run build

# Production Stage: static SPA plus the server-side AI proxy.
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/chat-proxy.mjs ./server/chat-proxy.mjs

EXPOSE 8080

CMD ["node", "server/chat-proxy.mjs"]
