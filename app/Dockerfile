# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies only
RUN apk add --no-cache python3 make g++

# Copy package files first (better layer caching)
COPY package*.json ./

# Install ALL dependencies (including devDeps for build)
RUN npm ci --only=production && \
    npm cache clean --force

# ─── Stage 2: Security Audit ─────────────────────────────────────────────────
FROM builder AS security-check

# Install dev deps for audit
RUN npm ci && npm audit --audit-level=high || true

# ─── Stage 3: Production Image ───────────────────────────────────────────────
FROM node:18-alpine AS production

# Security hardening labels
LABEL maintainer="DevSecOps Team"
LABEL org.opencontainers.image.title="E-Commerce API"
LABEL org.opencontainers.image.description="Secure e-commerce backend"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Infotact Solutions"
LABEL security.scan="trivy"

# Install only runtime system dependencies
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user and group for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set working directory
WORKDIR /app

# Copy production node_modules from builder stage
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application source
COPY --chown=appuser:appgroup . .

# Remove files not needed in production
RUN rm -rf \
    tests/ \
    .eslintrc* \
    .eslintignore \
    jest.config.js \
    *.md \
    .env* \
    coverage/ \
    test-results/

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Health check using the /health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "src/server.js"]
