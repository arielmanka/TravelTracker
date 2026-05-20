# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

# Create folders for SQLite database and uploaded receipts
RUN mkdir -p /app/data/receipts

EXPOSE 8000
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
