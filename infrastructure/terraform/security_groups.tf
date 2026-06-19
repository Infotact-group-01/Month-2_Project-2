###############################################################################
# Network Security Controls
###############################################################################

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg-${var.environment}"
  description = "Allow public HTTPS traffic to the Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP redirect to HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_web_cidr
  }

  ingress {
    description = "HTTPS from approved web CIDRs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_web_cidr
  }

  egress {
    description     = "Forward traffic to application instances"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name = "${var.project_name}-alb-sg-${var.environment}"
  }
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-app-sg-${var.environment}"
  description = "Allow application traffic only from the ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Application port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "HTTPS outbound for patching and managed services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_egress_cidr
  }

  tags = {
    Name = "${var.project_name}-app-sg-${var.environment}"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg-${var.environment}"
  description = "Allow PostgreSQL only from application instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from application"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name = "${var.project_name}-rds-sg-${var.environment}"
  }
}
