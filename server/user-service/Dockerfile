FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build user-service
WORKDIR /app/user-service
COPY server/user-service/package*.json ./
RUN npm install --install-links
COPY server/user-service/tsconfig.json .
COPY server/user-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/user-service/dist ./dist
COPY --from=builder /app/user-service/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
