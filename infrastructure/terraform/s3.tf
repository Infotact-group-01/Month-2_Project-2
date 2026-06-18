###############################################################################
# S3 Buckets — E-Commerce Infrastructure
#
# IMPORTANT: Contains INTENTIONAL misconfigurations to demonstrate Checkov.
# Each finding is labeled with the Checkov check ID and remediation.
###############################################################################

# ─── Application Assets Bucket ────────────────────────────────────────────────
resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-${var.environment}-${random_id.suffix.hex}"

  # Prevent accidental deletion in production
  force_destroy = var.environment != "production"

  tags = {
    Name    = "${var.project_name}-assets"
    Purpose = "application-assets"
  }
}

# CHECKOV FINDING [CKV_AWS_18]: S3 access logging not enabled
# Remediation: Add aws_s3_bucket_logging resource
# Intentionally omitted to demonstrate the finding.

# CHECKOV FINDING [CKV_AWS_144]: S3 cross-region replication not enabled
# Remediation: Add replication_configuration block (acceptable for staging)

# CHECKOV FINDING [CKV2_AWS_61]: S3 lifecycle policy not enabled
# Remediation: Add aws_s3_bucket_lifecycle_configuration

# ─── S3 Versioning (CORRECT — not misconfigured) ─────────────────────────────
resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ─── S3 Encryption (CORRECT) ─────────────────────────────────────────────────
resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ─── S3 Public Access Block ───────────────────────────────────────────────────
# CHECKOV FINDING [CKV_AWS_53, CKV_AWS_54, CKV_AWS_55, CKV_AWS_56]:
# Public access not fully blocked on all settings
resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Terraform State Backup Bucket ────────────────────────────────────────────
resource "aws_s3_bucket" "tf_state_backup" {
  bucket = "${var.project_name}-tfstate-${var.environment}-${random_id.suffix.hex}"

  # CHECKOV FINDING [CKV_AWS_21]: Versioning should be enabled for state backup
  # Intentionally misconfigured:

  tags = {
    Name    = "${var.project_name}-tfstate-backup"
    Purpose = "terraform-state-backup"
  }
}

# CHECKOV FINDING [CKV_AWS_145]: State bucket lacks KMS encryption
# Remediation: Use KMS instead of AES256 for state bucket
resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state_backup.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256" # Should be aws:kms for state bucket
    }
  }
}

# INTENTIONAL MISCONFIGURATION: No public access block on state bucket
# This allows Checkov to flag it with CKV_AWS_53-56
# resource "aws_s3_bucket_public_access_block" "tf_state" { ... }

# ─── Logs Bucket ──────────────────────────────────────────────────────────────
resource "aws_s3_bucket" "logs" {
  bucket        = "${var.project_name}-logs-${var.environment}-${random_id.suffix.hex}"
  force_destroy = true

  tags = {
    Name    = "${var.project_name}-logs"
    Purpose = "access-logs"
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
