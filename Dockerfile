# Stage 1: Build the backend
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package config files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies
RUN npm ci

# Copy the rest of the monorepo source files
COPY . .

# Build backend
RUN npm run build -w backend

# Stage 2: Runner image for the backend
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy root package.json and workspace backend config
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built dist from builder stage
COPY --from=builder /app/backend/dist ./backend/dist

# Expose backend port
EXPOSE 3001

# Command to run the backend server
CMD ["npm", "start", "-w", "backend"]
