FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build recommendation-service
WORKDIR /app/recommendation-service
COPY server/recommendation-service/package*.json ./
RUN npm install --install-links
COPY server/recommendation-service/tsconfig.json .
COPY server/recommendation-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/recommendation-service/dist ./dist
COPY --from=builder /app/recommendation-service/node_modules ./node_modules
EXPOSE 3005
CMD ["node", "dist/index.js"]
