FROM node:24-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3100 \
    HOSTNAME=0.0.0.0 \
    APP_VERSION=4.0.1 \
    WACOPY_DB_PATH=/data/wacopy.db

LABEL org.opencontainers.image.title="Maaviron" \
      org.opencontainers.image.version="4.0.1"

RUN groupadd --system --gid 1001 maaviron && \
    useradd --system --uid 1001 --gid maaviron maaviron && \
    mkdir -p /data && chown maaviron:maaviron /data

COPY --from=builder --chown=maaviron:maaviron /app/node_modules ./node_modules
COPY --from=builder --chown=maaviron:maaviron /app/dist ./dist
COPY --from=builder --chown=maaviron:maaviron /app/public ./public
COPY --from=builder --chown=maaviron:maaviron /app/package.json ./package.json

USER maaviron
EXPOSE 3100

CMD ["node", "node_modules/vinext/dist/cli.js", "start", "--hostname", "0.0.0.0", "--port", "3100"]
