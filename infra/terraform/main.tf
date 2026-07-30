provider "aws" {
  region = var.aws_region

  # --- Offline-plan configuration ---
  # These let `terraform plan` run WITHOUT a real AWS account so the config can be
  # reviewed safely (no resources are ever created). A real deployment removes this
  # block's dummy keys/skips and supplies credentials via env vars or an IAM role.
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_requesting_account_id  = true
  skip_metadata_api_check     = true
}

# ===========================================================================
# S3 - résumé storage: private bucket, versioned, with a lifecycle policy
# ===========================================================================
resource "aws_s3_bucket" "resumes" {
  bucket = var.resume_bucket_name
  tags   = { Project = var.project }
}

resource "aws_s3_bucket_public_access_block" "resumes" {
  bucket                  = aws_s3_bucket.resumes.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "resumes" {
  bucket = aws_s3_bucket.resumes.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  rule {
    id     = "expire-old-resumes"
    status = "Enabled"
    filter {}
    expiration {
      days = var.resume_expiration_days
    }
  }
}

# ===========================================================================
# IAM - least-privilege role the app assumes (e.g. an ECS task) to use the bucket
# ===========================================================================
data "aws_iam_policy_document" "assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  name               = "${var.project}-app-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json
  tags               = { Project = var.project }
}

# Only the S3 actions the app actually needs on only this bucket.
data "aws_iam_policy_document" "s3_access" {
  statement {
    sid       = "ResumeObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.resumes.arn}/*"]
  }
  statement {
    sid       = "ResumeBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.resumes.arn]
  }
}

resource "aws_iam_role_policy" "s3_access" {
  name   = "${var.project}-s3-access"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.s3_access.json
}

# ===========================================================================
# ECR - registry for the API Docker image
# ===========================================================================
resource "aws_ecr_repository" "api" {
  name                 = "${var.project}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Project = var.project }
}

resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep only the last 10 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}
