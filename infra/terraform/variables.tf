variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name, used as a prefix for resource names"
  type        = string
  default     = "hiresignal"
}

variable "resume_bucket_name" {
  description = "S3 bucket for résumé storage (must be globally unique)"
  type        = string
  default     = "hiresignal-resumes-demo"
}

variable "resume_expiration_days" {
  description = "Delete résumé objects this many days after upload"
  type        = number
  default     = 90
}
