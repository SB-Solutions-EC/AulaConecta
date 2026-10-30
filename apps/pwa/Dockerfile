# Etapa de compilación de la PWA (React + Vite + TypeScript)
FROM node:22-alpine3.21 AS compilacion
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Etapa de ejecución con Nginx sin privilegios
FROM nginxinc/nginx-unprivileged:1.27-alpine3.21
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist /usr/share/nginx/html
USER 101
EXPOSE 8080

