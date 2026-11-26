# Etapa de compilación de ms-academico (NestJS + TypeScript)
# El cálculo de notas (packages/calculo-notas) llega como contexto aparte, igual que en la PWA:
#   docker build --build-context calculo-notas=packages/calculo-notas services/ms-academico
FROM node:24-alpine AS compilacion
# Se repite la estructura del repositorio: postinstall copia ../../packages/calculo-notas/src/*.ts
COPY --from=calculo-notas src /repo/packages/calculo-notas/src
WORKDIR /repo/services/ms-academico
COPY package.json package-lock.json prisma.config.ts ./
# El esquema va antes de npm ci: postinstall genera el cliente de Prisma y copia el cálculo de notas
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Imagen final de producción con usuario sin privilegios. Sin npm ni corepack: el servicio solo
# necesita node, y npm trae dependencias propias con vulnerabilidades que reporta Trivy.
FROM node:24-alpine
RUN apk upgrade --no-cache && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack && \
    addgroup -S -g 10001 app && \
    adduser -S -u 10001 -G app app
WORKDIR /app
ENV NODE_ENV=production
COPY --from=compilacion --chown=app:app /repo/services/ms-academico/node_modules ./node_modules
COPY --from=compilacion --chown=app:app /repo/services/ms-academico/dist ./dist
COPY --chown=app:app package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
ENTRYPOINT ["node", "dist/main.js"]
