###############################################################################
# Terraform Backend Configuration — Remote State
#
# Uncomment and configure before running terraform init for real deployments.
# For demo purposes, this is intentionally left using local state.
###############################################################################

# Remote backend configuration (S3 + DynamoDB locking)
# Uncomment this block when deploying to real AWS:
#
# terraform {
#   backend "s3" {
#     bucket         = "your-terraform-state-bucket"
#     key            = "ecommerce-devsecops/terraform.tfstate"
#     region         = "us-east-1"
#     encrypt        = true
#     dynamodb_table = "terraform-state-lock"
#
#     # Server-side encryption
#     kms_key_id = "alias/terraform-state-key"
#   }
# }

# ─── Local Backend (Demo / Development) ──────────────────────────────────────
# Uses local filesystem for state — DO NOT use in production
terraform {
  backend "local" {
    path = "terraform.tfstate"
  }
}
