FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build safe-space-service
WORKDIR /app/safe-space-service
COPY server/safe-space-service/package*.json ./
RUN npm install --install-links
COPY server/safe-space-service/tsconfig.json .
COPY server/safe-space-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/safe-space-service/dist ./dist
COPY --from=builder /app/safe-space-service/node_modules ./node_modules
EXPOSE 3004
CMD ["node", "dist/index.js"]
