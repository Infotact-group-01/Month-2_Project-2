###############################################################################
# Terraform Outputs - E-Commerce Infrastructure
###############################################################################

output "vpc_id" {
  description = "ID of the VPC."
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "IDs of public subnets used by the ALB."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "IDs of private subnets used by application and data tiers."
  value       = aws_subnet.private[*].id
}

output "app_instance_id" {
  description = "ID of the private application EC2 instance."
  value       = aws_instance.app.id
}

output "app_instance_private_ip" {
  description = "Private IP of the application EC2 instance."
  value       = aws_instance.app.private_ip
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer."
  value       = aws_lb.main.dns_name
}

output "assets_bucket_name" {
  description = "Name of the encrypted S3 assets bucket."
  value       = aws_s3_bucket.assets.id
}

output "logs_bucket_name" {
  description = "Name of the centralized access log bucket."
  value       = aws_s3_bucket.logs.id
}

output "rds_endpoint" {
  description = "RDS instance endpoint."
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

output "app_security_group_id" {
  description = "Security group ID for the application."
  value       = aws_security_group.app.id
}
