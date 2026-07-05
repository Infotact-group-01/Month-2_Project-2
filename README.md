# Enterprise DevSecOps E-Commerce IaC Pipeline

This project is a complete API-first e-commerce DevSecOps reference implementation. It pairs a sample Node.js commerce API with Docker, Terraform, GitHub Actions, and a multi-layer security gate covering SAST, SCA, container scanning, IaC scanning, and DAST.

The default path is secure and intended to pass the pipeline. A separate manual failure-demo workflow scans intentionally vulnerable fixtures so reviewers can see the security gate block critical issues.

## Architecture

| Layer | Implementation | Security Gate |
| --- | --- | --- |
| Application | Express API for auth, products, cart, orders, and health checks | ESLint, Jest, Semgrep, npm audit |
| Supply chain | Locked npm dependencies | npm audit and Trivy filesystem scan |
| Container | Multi-stage non-root Docker image | Trivy image scan |
| Infrastructure | AWS Terraform baseline with private app tier, encrypted storage, WAF, ALB, RDS, S3 controls | Terraform validate and Checkov |
| Runtime | Containerized API scanned in an isolated CI network | OWASP ZAP baseline scan |

## Repository Layout

```text
app/                              Node.js e-commerce API
infrastructure/terraform/          Secure Terraform baseline
security-fixtures/vulnerable/      Intentionally vulnerable demo fixtures
.github/workflows/                 CI/CD and security gate workflows
docker-compose.yml                 Local app stack
docker-compose.security.yml        Local scanner stack
```

## Local Setup

```bash
cd app
npm ci
npm run lint
npm run test:ci
npm run audit:ci
```

Run the app locally:

```bash
docker compose up --build
```

Useful endpoints:

```text
GET http://localhost:3000/health
GET http://localhost:3000/api
GET http://localhost:3000/api/products
```

## Security Pipeline

The main workflow is `.github/workflows/devsecops-pipeline.yml`.

It runs on push, pull request, and manual dispatch:

1. Installs dependencies with `npm ci`.
2. Runs ESLint and Jest with coverage/JUnit reports.
3. Runs `npm audit --audit-level=high`.
4. Runs Semgrep against `app/src`.
5. Optionally runs SonarQube/SonarCloud when secrets are configured.
6. Validates Terraform formatting and syntax.
7. Runs Checkov against the secure Terraform baseline.
8. Builds the production Docker image.
9. Runs Trivy filesystem and image scans for `HIGH` and `CRITICAL` findings.
10. Starts the container and runs OWASP ZAP baseline DAST, failing on high-risk alerts.

Generated reports are uploaded as GitHub Actions artifacts and ignored locally by git.

## Manual Failure Demo

The workflow `.github/workflows/security-gate-demo.yml` is manual only. It scans:

- `security-fixtures/vulnerable/terraform` for open SSH, public S3, public unencrypted RDS, and broad egress.
- `security-fixtures/vulnerable/app` for vulnerable dependencies and insecure code.

This workflow intentionally ends red after confirming the tools detect the vulnerable fixtures. That is expected and demonstrates the strict gate behavior requested in the project.

## Optional SonarQube/SonarCloud

Semgrep is the guaranteed SAST gate. Sonar is enabled automatically when these repository secrets exist:

```text
SONAR_TOKEN
SONAR_HOST_URL
SONAR_PROJECT_KEY
```

If the secrets are absent, the pipeline skips Sonar and still enforces SAST through Semgrep.

## Local Security Scans

Run the local security stack:

```bash
docker compose -f docker-compose.security.yml up --build --abort-on-container-exit
```

Reports are written under `reports/`.

Individual tools used by the stack:

```text
Semgrep: app source SAST
Trivy fs: package and dependency scan
Trivy image: production image scan
Checkov: Terraform IaC scan
OWASP ZAP: runtime baseline DAST
```

## Terraform Notes

The secure baseline is under `infrastructure/terraform`.

It includes:

- Private EC2 application tier with IMDSv2 and encrypted root volume.
- ALB with HTTPS listener, HTTP redirect, access logging, and WAF association.
- RDS PostgreSQL with encryption, managed master password, enhanced monitoring, backups, and deletion protection.
- S3 buckets with KMS encryption, versioning, public access blocks, lifecycle controls, and access logging.
- VPC flow logs encrypted with KMS.

Copy `infrastructure/terraform/terraform.tfvars.example` before real deployment and replace placeholder account and certificate values.

## Report Triage

Use this priority order:

1. Critical and high CVEs from `npm audit` or Trivy.
2. Checkov failures that expose public access, missing encryption, broad security groups, or weak logging.
3. Semgrep findings involving injection, secrets, auth, JWT misuse, or unsafe deserialization.
4. OWASP ZAP high-risk alerts.

For each finding, record the affected file/resource, severity, scanner evidence, remediation, and whether the fix changes application behavior or infrastructure policy.

## Roadmap Mapping

| Week | Deliverable | Implemented In |
| --- | --- | --- |
| 1 | Containerized app and SAST | `app/Dockerfile`, Semgrep workflow |
| 2 | Dependency and container scanning | npm audit, Trivy fs/image scans |
| 3 | IaC security scanning | Terraform secure baseline and Checkov |
| 4 | DAST and pipeline hardening | OWASP ZAP job, artifacts, strict failure gates |

## Environment Variables

| Name | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime environment (`development`, `test`, `production`) |
| `PORT` | API port, default `3000` |
| `HOST` | Bind host, default `0.0.0.0` |
| `JWT_SECRET` | Required in production, minimum 32 characters |
| `JWT_EXPIRES_IN` | Access token lifetime, default `24h` |
| `CORS_ORIGIN` | Allowed origin or comma-separated origins |
| `RATE_LIMIT_MAX` | API rate limit per window |

## API Surface

```text
GET  /health
GET  /api/health
GET  /api
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
GET  /api/products
GET  /api/products/:id
GET  /api/cart
POST /api/cart/items
GET  /api/orders
POST /api/orders
```


