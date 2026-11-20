# Imagen de un solo uso para aplicar las migraciones de db_academico en el ambiente de pruebas (T1116-A).
# Contexto: services/ms-academico. Solo lleva el lockfile, prisma.config.ts y prisma/ (no el código del
# servicio): la imagen publicada de ms-academico no incluye la CLI de Prisma, que es dependencia de desarrollo.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
# postinstall genera el cliente de Prisma; las versiones salen del lockfile
RUN npm ci --no-audit --no-fund && chown -R node:node /app
USER node
ENTRYPOINT ["npx", "prisma", "migrate", "deploy"]
