# Etapa de compilación de ms-academico (TypeScript)
FROM node:22-alpine3.21 AS compilacion
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npm run build

# Imagen final de producción con usuario sin privilegios
FROM node:22-alpine3.21
RUN addgroup -S -g 10001 app && adduser -S -u 10001 -G app app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=compilacion /app/dist ./dist
COPY package.json ./
USER app
EXPOSE 3000
ENTRYPOINT ["node", "dist/main.js"]

