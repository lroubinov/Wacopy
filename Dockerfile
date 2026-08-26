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
    HOST=0.0.0.0 \
    APP_VERSION=5.0.0 \
    WACOPY_DB_PATH=/data/wacopy.db \
    WACOPY_IMAGE_PATH=/data/images

LABEL org.opencontainers.image.title="Maaviron" \
      org.opencontainers.image.version="5.0.0"

RUN groupadd --system --gid 1001 maaviron && \
    useradd --system --uid 1001 --gid maaviron maaviron && \
    mkdir -p /data/images && chown -R maaviron:maaviron /data

COPY --from=builder --chown=maaviron:maaviron /app/dist/standalone ./

USER maaviron
EXPOSE 3100

CMD ["node", "server.js"]
