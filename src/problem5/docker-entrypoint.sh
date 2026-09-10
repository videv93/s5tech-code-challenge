#!/bin/sh
# Apply any pending migrations before the server accepts traffic.
#
# `migrate deploy` (not `migrate dev`) is the production command: it applies
# committed migrations and never generates, prompts, or resets. It is
# idempotent, so restarting the container is safe.
set -e

echo "[entrypoint] applying migrations…"
npx prisma migrate deploy

echo "[entrypoint] starting server…"
exec "$@"
