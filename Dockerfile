# Stage 1: Build the backend and frontend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package config files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy the rest of the monorepo source files
COPY . .

# Build backend and frontend
RUN npm run build -w backend
RUN npm run build -w frontend

# Stage 2: Runner image for the backend
FROM node:20-alpine AS runner

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
