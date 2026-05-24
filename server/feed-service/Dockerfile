FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build feed-service
WORKDIR /app/feed-service
COPY server/feed-service/package*.json ./
RUN npm install --install-links
COPY server/feed-service/tsconfig.json .
COPY server/feed-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/feed-service/dist ./dist
COPY --from=builder /app/feed-service/node_modules ./node_modules
EXPOSE 3002
CMD ["node", "dist/index.js"]
