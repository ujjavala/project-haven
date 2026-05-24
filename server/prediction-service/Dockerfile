FROM node:20-alpine AS builder
WORKDIR /app

# 1. Build shared package so npm can link it
COPY server/shared ./shared
WORKDIR /app/shared
RUN npm install && npm run build

# 2. Build prediction-service
WORKDIR /app/prediction-service
COPY server/prediction-service/package*.json ./
RUN npm install --install-links
COPY server/prediction-service/tsconfig.json .
COPY server/prediction-service/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/prediction-service/dist ./dist
COPY --from=builder /app/prediction-service/node_modules ./node_modules
EXPOSE 3003
CMD ["node", "dist/index.js"]
