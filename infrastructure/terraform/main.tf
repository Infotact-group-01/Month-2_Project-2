###############################################################################
# E-Commerce Infrastructure — Terraform Main Configuration
# Provider: AWS
#
# IMPORTANT: This file contains INTENTIONAL misconfigurations to demonstrate
# the IaC security scanner (Checkov/TFSec) in the DevSecOps pipeline.
# In a real deployment, fix all Checkov findings before applying.
###############################################################################

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ecommerce-devsecops"
      Environment = var.environment
      ManagedBy   = "terraform"
      CostCenter  = "engineering"
    }
  }
}

# ─── Random ID for unique resource naming ────────────────────────────────────
resource "random_id" "suffix" {
  byte_length = 4
}

# ─── VPC ────────────────────────────────────────────────────────────────────
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc-${var.environment}"
  }
}

# ─── Internet Gateway ────────────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw-${var.environment}"
  }
}

# ─── Public Subnets ──────────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone = var.availability_zones[count.index]

  # CHECKOV FINDING [CKV_AWS_130]: Subnet auto-assigns public IPs
  # In production: set to false and use a NAT gateway/bastion
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-${count.index + 1}-${var.environment}"
    Tier = "public"
  }
}

# ─── Private Subnets ─────────────────────────────────────────────────────────
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = var.availability_zones[count.index]

  map_public_ip_on_launch = false

  tags = {
    Name = "${var.project_name}-private-subnet-${count.index + 1}-${var.environment}"
    Tier = "private"
  }
}

# ─── Route Table ─────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# ─── EC2 Instance (Application Server) ───────────────────────────────────────
resource "aws_instance" "app" {
  ami           = var.ami_id
  instance_type = var.instance_type
  subnet_id     = aws_subnet.public[0].id

  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  # CHECKOV FINDING [CKV_AWS_8]: No encrypted EBS root volume
  # Remediation: Add root_block_device with encrypted = true
  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = false # ← INTENTIONAL MISCONFIGURATION (CKV_AWS_8)
  }

  # CHECKOV FINDING [CKV_AWS_135]: Detailed monitoring disabled
  # Remediation: Set monitoring = true
  monitoring = false # ← INTENTIONAL MISCONFIGURATION

  user_data = base64encode(templatefile("${path.module}/scripts/user_data.sh.tpl", {
    project_name = var.project_name
    environment  = var.environment
  }))

  tags = {
    Name = "${var.project_name}-app-${var.environment}"
    Role = "application"
  }
}

# ─── IAM Role for EC2 ────────────────────────────────────────────────────────
resource "aws_iam_role" "app" {
  name = "${var.project_name}-app-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project_name}-app-profile-${var.environment}"
  role = aws_iam_role.app.name
}

# Allow EC2 to read from SSM Parameter Store
resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# ─── Application Load Balancer ────────────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # CHECKOV FINDING [CKV_AWS_91]: ALB access logging disabled
  # Remediation: Enable access_logs block
  enable_deletion_protection = false # ← INTENTIONAL MISCONFIGURATION in staging

  tags = {
    Name = "${var.project_name}-alb-${var.environment}"
  }
}

resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-tg-${var.environment}"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    matcher             = "200"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  # CHECKOV FINDING [CKV_AWS_2]: HTTP listener should redirect to HTTPS
  # Remediation: Add redirect to HTTPS
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app.id
  port             = 3000
}
