###############################################################################
# Terraform Variables - E-Commerce Infrastructure
###############################################################################

variable "aws_region" {
  description = "AWS region used for the secure baseline."
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID used in log bucket policies."
  type        = string
  default     = "123456789012"

  validation {
    condition     = can(regex("^[0-9]{12}$", var.aws_account_id))
    error_message = "aws_account_id must be a 12 digit AWS account ID."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be one of: dev, staging, production."
  }
}

variable "project_name" {
  description = "Project name used as a prefix for resources."
  type        = string
  default     = "ecommerce-devsecops"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones used for public and private subnets."
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "allowed_web_cidr" {
  description = "CIDR ranges allowed to reach the public ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_egress_cidr" {
  description = "CIDR ranges allowed for restricted outbound HTTPS."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the HTTPS listener."
  type        = string
  default     = "arn:aws:acm:us-east-1:123456789012:certificate/00000000-0000-0000-0000-000000000000"
}

variable "ami_id" {
  description = "Hardened AMI ID for EC2 application instances."
  type        = string
  default     = "ami-0c02fb55956c7d316"
}

variable "instance_type" {
  description = "EC2 instance type."
  type        = string
  default     = "t3.micro"

  validation {
    condition     = can(regex("^t[23]\\.(micro|small|medium|large)$", var.instance_type))
    error_message = "Instance type must be a t2 or t3 micro/small/medium/large instance."
  }
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_name" {
  description = "Database name."
  type        = string
  default     = "ecommerce"
}

variable "db_username" {
  description = "Database master username. The password is managed by AWS Secrets Manager."
  type        = string
  default     = "ecommerceadmin"
  sensitive   = true
}
