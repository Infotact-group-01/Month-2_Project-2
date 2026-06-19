terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_security_group" "ssh_open_to_world" {
  name        = "vulnerable-ssh"
  description = "Intentionally vulnerable SSH ingress"

  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_s3_bucket" "public_assets" {
  bucket = "vulnerable-ecommerce-public-assets-demo"
}

resource "aws_s3_bucket_public_access_block" "public_assets" {
  bucket                  = aws_s3_bucket.public_assets.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_db_instance" "unencrypted" {
  identifier          = "vulnerable-ecommerce-db"
  engine              = "postgres"
  instance_class      = "db.t3.micro"
  allocated_storage   = 20
  username            = "admin"
  password            = "Password123!"
  publicly_accessible = true
  storage_encrypted   = false
  skip_final_snapshot = true
}
