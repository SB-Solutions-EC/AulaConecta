# Etapa de compilación de ms-academico (NestJS + TypeScript)
FROM node:24-alpine AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Imagen final de producción con usuario sin privilegios
FROM node:24-alpine
RUN apk upgrade --no-cache && \
    addgroup -S -g 10001 app && \
    adduser -S -u 10001 -G app app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=compilacion --chown=app:app /app/node_modules ./node_modules
COPY --from=compilacion --chown=app:app /app/dist ./dist
COPY --chown=app:app package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
ENTRYPOINT ["node", "dist/main.js"]
