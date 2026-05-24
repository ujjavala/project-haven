FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build api-gateway
WORKDIR /app/api-gateway
COPY server/api-gateway/package*.json ./
RUN npm install --install-links
COPY server/api-gateway/tsconfig.json .
COPY server/api-gateway/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/api-gateway/dist ./dist
COPY --from=builder /app/api-gateway/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/index.js"]
