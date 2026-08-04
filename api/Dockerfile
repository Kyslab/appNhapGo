FROM node:24-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY mobile/package.json mobile/package.json
RUN npm ci --workspace api --include-workspace-root

COPY api ./api
RUN npm --workspace api run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/api/package.json ./api/package.json
COPY --from=build /app/api/dist ./api/dist
COPY --from=build /app/api/db ./api/db

EXPOSE 4000
CMD ["sh", "-c", "node api/dist/migrate.js && exec node api/dist/server.js"]
