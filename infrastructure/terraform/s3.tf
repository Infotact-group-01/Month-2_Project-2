###############################################################################
# Storage Security Controls
###############################################################################

resource "aws_kms_key" "storage" {
  description             = "KMS key for ${var.project_name} storage encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

resource "aws_kms_alias" "storage" {
  name          = "alias/${var.project_name}-${var.environment}-storage"
  target_key_id = aws_kms_key.storage.key_id
}

#checkov:skip=CKV_AWS_144:Cross-region replication is outside the MVP scope.
resource "aws_s3_bucket" "assets" {
  bucket        = "${var.project_name}-assets-${var.environment}-${random_id.suffix.hex}"
  force_destroy = false

  tags = {
    Name    = "${var.project_name}-assets"
    Purpose = "application-assets"
  }
}

resource "aws_s3_bucket_versioning" "assets" {
  bucket = aws_s3_bucket.assets.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.storage.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_logging" "assets" {
  bucket        = aws_s3_bucket.assets.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3/assets/"
}

resource "aws_s3_bucket_lifecycle_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id

  rule {
    id     = "expire-noncurrent-assets"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

#checkov:skip=CKV_AWS_18:This bucket is the centralized access log destination.
#checkov:skip=CKV_AWS_144:Cross-region replication is outside the MVP scope.
resource "aws_s3_bucket" "logs" {
  bucket        = "${var.project_name}-logs-${var.environment}-${random_id.suffix.hex}"
  force_destroy = false

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
      kms_master_key_id = aws_kms_key.storage.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "logs" {
  bucket                  = aws_s3_bucket.logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "retain-logs"
    status = "Enabled"

    expiration {
      days = 365
    }
  }
}

data "aws_iam_policy_document" "logs" {
  statement {
    sid     = "AllowALBAccessLogs"
    actions = ["s3:PutObject"]

    principals {
      type        = "Service"
      identifiers = ["logdelivery.elasticloadbalancing.amazonaws.com"]
    }

    resources = ["${aws_s3_bucket.logs.arn}/alb/AWSLogs/${var.aws_account_id}/*"]
  }
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.logs.id
  policy = data.aws_iam_policy_document.logs.json
}

#checkov:skip=CKV_AWS_144:Cross-region replication is outside the MVP scope.
resource "aws_s3_bucket" "tf_state_backup" {
  bucket        = "${var.project_name}-tfstate-${var.environment}-${random_id.suffix.hex}"
  force_destroy = false

  tags = {
    Name    = "${var.project_name}-tfstate-backup"
    Purpose = "terraform-state-backup"
  }
}

resource "aws_s3_bucket_versioning" "tf_state_backup" {
  bucket = aws_s3_bucket.tf_state_backup.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state_backup" {
  bucket = aws_s3_bucket.tf_state_backup.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.storage.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state_backup" {
  bucket                  = aws_s3_bucket.tf_state_backup.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "tf_state_backup" {
  bucket = aws_s3_bucket.tf_state_backup.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_logging" "tf_state_backup" {
  bucket        = aws_s3_bucket.tf_state_backup.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3/tfstate/"
}

resource "aws_s3_bucket_lifecycle_configuration" "tf_state_backup" {
  bucket = aws_s3_bucket.tf_state_backup.id

  rule {
    id     = "retain-state-versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 180
    }
  }
}
