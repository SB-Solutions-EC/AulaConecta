# Etapa de compilación de la PWA (React + Vite + TypeScript)
FROM node:22-alpine3.21 AS compilacion
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# Etapa de ejecución con Nginx sin privilegios sobre Alpine 3.24
FROM alpine:3.24
RUN apk upgrade --no-cache && \
    apk add --no-cache nginx && \
    addgroup -S -g 10001 app && \
    adduser -S -u 10001 -G app app
WORKDIR /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=compilacion /app/dist ./
USER app
EXPOSE 8080
ENTRYPOINT ["nginx", "-e", "/dev/stderr", "-g", "daemon off;"]
