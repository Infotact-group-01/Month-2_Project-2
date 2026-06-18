###############################################################################
# Security Groups — E-Commerce Infrastructure
#
# IMPORTANT: Contains INTENTIONAL misconfigurations to demonstrate Checkov/TFSec
###############################################################################

# ─── ALB Security Group ───────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  # Allow HTTP from internet (production should HTTPS only)
  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # All internet traffic allowed
  }

  # Allow HTTPS from internet
  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }
}

# ─── Application Security Group ───────────────────────────────────────────────
resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg-${var.environment}"
  description = "Security group for application EC2 instances"
  vpc_id      = aws_vpc.main.id

  # CHECKOV FINDING [CKV_AWS_25]: SSH port open to the world
  # Remediation: Restrict SSH to specific IP / use SSM Session Manager
  ingress {
    description = "SSH access"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # ← INTENTIONAL MISCONFIGURATION (CKV_AWS_25)
  }

  # Allow app port from ALB only (CORRECT)
  ingress {
    description     = "App port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # CHECKOV FINDING [CKV_AWS_277]: All outbound allowed
  # Remediation: Restrict egress to specific ports/protocols
  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"] # ← INTENTIONAL MISCONFIGURATION
  }

  tags = {
    Name = "${var.project_name}-app-sg-${var.environment}"
  }
}

# ─── RDS Security Group ───────────────────────────────────────────────────────
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Security group for RDS database"
  vpc_id      = aws_vpc.main.id

  # Allow PostgreSQL from app servers only (CORRECT)
  ingress {
    description     = "PostgreSQL from app"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # CHECKOV FINDING: No egress defined — Terraform creates allow-all by default
  # Remediation: Explicitly define egress with restrictions

  tags = {
    Name = "${var.project_name}-rds-sg-${var.environment}"
  }
}

# ─── RDS Subnet Group ─────────────────────────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# ─── RDS Instance ─────────────────────────────────────────────────────────────
resource "aws_db_instance" "main" {
  identifier        = "${var.project_name}-db-${var.environment}"
  engine            = "postgres"
  engine_version    = "15.4"
  instance_class    = var.db_instance_class
  allocated_storage = 20
  storage_type      = "gp3"

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  # CHECKOV FINDING [CKV_AWS_16]: RDS not encrypted at rest
  # Remediation: storage_encrypted = true
  storage_encrypted = false # ← INTENTIONAL MISCONFIGURATION

  # CHECKOV FINDING [CKV_AWS_118]: Performance Insights disabled
  performance_insights_enabled = false # ← INTENTIONAL MISCONFIGURATION

  # CHECKOV FINDING [CKV_AWS_129]: RDS publicly accessible
  publicly_accessible = false # CORRECT

  backup_retention_period = 7
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"

  # CHECKOV FINDING [CKV_AWS_293]: Minor version upgrades not enabled
  auto_minor_version_upgrade = false # ← INTENTIONAL MISCONFIGURATION

  tags = {
    Name = "${var.project_name}-db-${var.environment}"
  }
}
