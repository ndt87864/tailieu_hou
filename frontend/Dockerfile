# Stage 1: Build Frontend (Vite)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY frontend/package*.json ./frontend/

RUN npm ci

COPY . .

RUN npm run build -w frontend

# Stage 2: Serve with Nginx
FROM nginx:alpine AS runner

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY vps-deployment/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
