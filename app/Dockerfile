# syntax=docker/dockerfile:1

# Stage 1: install production dependencies
FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev && \
    npm cache clean --force

# Stage 2: production runtime
FROM node:22-alpine AS production

LABEL maintainer="DevSecOps Team"
LABEL org.opencontainers.image.title="E-Commerce API"
LABEL org.opencontainers.image.description="Secure e-commerce backend"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Infotact Solutions"
LABEL security.scan="trivy"

RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

COPY --from=dependencies --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package*.json ./
COPY --chown=appuser:appgroup src ./src

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
