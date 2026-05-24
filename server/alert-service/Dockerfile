FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build alert-service
WORKDIR /app/alert-service
COPY server/alert-service/package*.json ./
RUN npm install --install-links
COPY server/alert-service/tsconfig.json .
COPY server/alert-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/alert-service/dist ./dist
COPY --from=builder /app/alert-service/node_modules ./node_modules
EXPOSE 3006
CMD ["node", "dist/index.js"]
