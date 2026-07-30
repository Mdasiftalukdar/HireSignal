output "resume_bucket" {
  description = "S3 bucket for résumé storage"
  value       = aws_s3_bucket.resumes.bucket
}

output "app_role_arn" {
  description = "IAM role the app assumes to access the bucket"
  value       = aws_iam_role.app.arn
}

output "ecr_repository_url" {
  description = "ECR repository URL for the API image"
  value       = aws_ecr_repository.api.repository_url
}
