# Multi-stage build: the runtime image carries no compiler and no dev
# dependencies, only what the process actually needs to run.

FROM node:22-slim AS build
WORKDIR /app

# prisma.config.ts resolves DATABASE_URL when the CLI loads it — even for
# `generate`, which never opens a connection. A placeholder satisfies that
# without baking a real connection string into a layer.
ENV DATABASE_URL=file:/tmp/build.db

# Dependencies first, so a source-only change does not invalidate the install
# layer. --ignore-scripts because the postinstall hook needs the schema, which
# has not been copied yet; generate is run explicitly below.
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY prisma.config.ts tsconfig*.json ./
COPY prisma ./prisma
COPY src ./src

# `prisma generate` emits the client into src/db/generated, so it must run
# before tsc — the build compiles it into dist along with everything else.
RUN npx prisma generate && npm run build


FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    # The database lives on a mounted volume, not in the image layer, so it
    # survives a redeploy.
    DATABASE_URL=file:/data/prod.db

# --ignore-scripts again: the postinstall would regenerate the client into a
# src/ tree this stage does not have. The generated client is already compiled
# into dist by the build stage.
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts \
 # better-sqlite3 is a native addon: --ignore-scripts skipped the step that
 # fetches its prebuilt binding, so the process would start and then fail on
 # the first query with "Could not locate the bindings file". Rebuilding just
 # this one package restores it without re-running Prisma's postinstall.
 && npm rebuild better-sqlite3 \
 && npm cache clean --force

COPY --from=build /app/dist ./dist
# The migration SQL and the config that resolves DATABASE_URL — both are read
# at startup by `prisma migrate deploy`.
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data \
 && chown -R node:node /data /app

# The node image ships a non-root user; use it rather than running as root.
USER node

EXPOSE 3000

# Hits the liveness probe, which deliberately does not touch the database —
# see src/modules/health/health.routes.ts.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
