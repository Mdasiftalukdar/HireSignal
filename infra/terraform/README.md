# HireSignal — Infrastructure as Code (Terraform)

Declarative AWS infrastructure for HireSignal:

- **S3** — private, versioned résumé bucket with a lifecycle expiry policy
- **IAM** — a least-privilege role the app assumes (only the S3 actions it needs, only this bucket)
- **ECR** — a registry for the API Docker image, with image scanning + a "keep last 10" policy

## Files

| File | Purpose |
|------|---------|
| `versions.tf` | Terraform + AWS provider version constraints |
| `variables.tf` | Inputs (region, project, bucket name, retention) |
| `main.tf` | S3 + IAM + ECR resources |
| `outputs.tf` | Bucket name, IAM role ARN, ECR URL |

## Plan it (no AWS account required)

The provider is configured with dummy credentials + skip flags so `terraform plan` runs
**offline** — it shows what *would* be created. We deliberately **do not `apply`** (the plan
proves the configuration; no cloud spend).

```bash
cd infra/terraform
terraform init
terraform validate
terraform plan
```

**Verified:** `Plan: 8 to add, 0 to change, 0 to destroy` — S3 bucket (+ public-access block,
versioning, lifecycle), IAM role (+ least-privilege policy), and ECR repo (+ lifecycle policy).

## For a real deployment

Remove the dummy `access_key`/`secret_key` + `skip_*` lines from the `provider "aws"` block,
authenticate with real credentials (environment variables or an IAM role), set a globally-unique
`resume_bucket_name`, then `terraform apply`.
