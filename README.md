# Terraform Sample Workflow

A simple and practical template for managing AWS infrastructure with Terraform and GitHub Actions. This project demonstrates multi-environment deployment workflows, automated CI/CD pipelines, and Infrastructure as Code (IaC) patterns. This repository serves as a learning resource and starting point for teams looking to implement Terraform workflows.

## Features

- **Multi-Environment Support**: Isolated workspaces for dev, staging, and production
- **GitHub Actions Integration**: Manual deployments and automatic PR validation
- **AWS SNS/SQS Example**: Complete messaging infrastructure with FIFO queues and DLQs
- **Environment-Specific Configs**: Different retention policies and timeouts per environment
- **State Management**: S3 backend with encryption and workspace isolation
- **Code Quality**: Automated formatting checks and validation

## Installing Terraform CLI

Before running Terraform commands locally, you need to install the Terraform CLI.

**macOS (Homebrew):**
```bash
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

**Linux (Ubuntu/Debian):**
```bash
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```

**Verify installation:**
```bash
terraform version
```

For other installation methods and operating systems, see the [official Terraform installation guide](https://developer.hashicorp.com/terraform/install).

### Environments

- `dev` - Development
- `staging` - Staging
- `prod` - Production

### File Structure

```
iac/terraform/
├── providers.tf        # AWS configuration and S3 backend
├── variables.tf        # Variable declarations
├── locals.tf           # Local values (naming, tags, environment configs)
├── sns.tf              # SNS Topic FIFO
├── sqs.tf              # SQS Queue FIFO + DLQ
├── subscriptions.tf    # SNS -> SQS subscriptions
├── iam.tf              # IAM/SQS policies
└── outputs.tf          # Outputs (ARNs, URLs)
```

### Running Commands Locally

We don't recommend running terraform commands on your local machine, but these commands can be useful at times. Always prefer using GitHub Actions to interact with terraform resources.

This project uses **Terraform Workspaces** to manage multiple environments with isolated states.

```bash
# Initialize
terraform init

# Select or create workspace
terraform workspace select dev  # or create: terraform workspace new dev

# List available workspaces
terraform workspace list

# View current workspace
terraform workspace show

# Plan
terraform plan

# Apply
terraform apply

# Destroy (careful!)
terraform destroy
```

Complete example:
```bash
cd iac/terraform
terraform init
terraform workspace select dev
terraform plan
terraform apply
```

## AWS Credentials Configuration

The GitHub Actions workflow supports two methods for AWS authentication:

### Option 1: OIDC with IAM Role (Recommended)

Uses OpenID Connect to assume an IAM role without storing long-term credentials.

**Setup:**
1. Create an IAM OIDC identity provider in AWS for GitHub Actions
2. Create an IAM role with trust policy for your GitHub repository
3. Add the role ARN as a GitHub secret: `AWS_ROLE`

**GitHub Secret Required:**
- `AWS_ROLE` - IAM Role ARN (e.g., `arn:aws:iam::123456789012:role/GitHubActionsRole`)

**References:**
- [AWS - Configuring OpenID Connect in AWS](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html)
- [GitHub - Configure AWS Credentials Action](https://github.com/aws-actions/configure-aws-credentials)

### Option 2: Access Keys

Uses static AWS access keys (less secure, not recommended for production).

**Setup:**
1. Create an IAM user with programmatic access
2. Generate access keys for the user
3. Add the keys as GitHub secrets

**GitHub Secrets Required:**
- `AWS_ACCESS_KEY_ID` - Your AWS access key ID
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret access key

**Note:** If `AWS_ROLE` is configured, the workflow will use OIDC (Option 1). Otherwise, it will fall back to access keys (Option 2).

### Usage via GitHub Actions

1. Access **Actions → Terraform**
2. Click **Run workflow**
3. Select:
   - **Environment:** dev, staging, prod
   - **Action:** plan, apply
4. Check logs and outputs

### Automatic Plan on PRs

When opening a Pull Request with changes to `iac/terraform/**`, the workflow automatically:
- Checks Terraform file formatting
- Validates file syntax
- Runs `terraform plan` for the `dev` environment
- Comments the result on the PR
- Allows reviewing changes before merge

### Terraform Code Formatting

GitHub Actions automatically checks if Terraform files are properly formatted. If the check fails, you'll see a message indicating which files need formatting.

**How to fix formatting issues:**

```bash
# Navigate to the Terraform directory
cd iac/terraform

# Format all files automatically
terraform fmt -recursive

# Check formatting without changing files (useful to validate before committing)
terraform fmt -check -recursive
```

The `terraform fmt` command automatically formats all `.tf` files following Terraform's standard conventions.

### Terraform State

- **Backend:** S3 with Workspaces
- **Bucket:** `my-terraform-state-bucket` (change to your bucket)
- **Key Base:** `sample-app/terraform.tfstate`
- **Workspace Prefix:** `env`
- **Region:** us-east-1
- **Encryption:** Enabled
- **Organization:** Each workspace (environment) has its own isolated state file
  - `env/dev/terraform.tfstate`
  - `env/staging/terraform.tfstate`
  - `env/prod/terraform.tfstate`

### Workspaces

This project uses **Terraform Workspaces** to manage environments. The active workspace determines which environment is being managed.

**Available workspaces:**
- `dev` - Development
- `staging` - Staging
- `prod` - Production

**How it works:**
- Each workspace has its own isolated state file in S3
- The workspace name is automatically used via `terraform.workspace`
- Resources are named with prefix: `{workspace}_sample_*`
- Example: `dev_sample_events.fifo` (SNS), `prod_sample_processor.fifo` (SQS)

### Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `aws_region` | AWS Region | `us-east-1` |

### SQS Configuration by Environment

SQS configurations are automatically defined based on the active workspace (environment):

| Environment | Message Retention | Visibility Timeout | DLQ Retention | Max Receive Count |
|-------------|------------------|-------------------|---------------|-------------------|
| `dev` | 1 day (86400s) | 30s | 4 days (345600s) | 3 |
| `staging` | 3 days (259200s) | 45s | 7 days (604800s) | 3 |
| `prod` | 7 days (604800s) | 60s | 14 days (1209600s) | 3 |

To add specific configurations for other environments, edit the `sqs_config` map in `iac/terraform/locals.tf`.

### Adding a New Environment

1. Add environment to workflow options in `.github/workflows/terraform.yml` (`environment.options` field)
2. Create workspace locally or via GitHub Actions (automatically created on first use)
3. Update this documentation in the "Workspaces" section

### Provisioned Resources

This example provisions:

**SNS (Simple Notification Service):**
- 1 SNS Topic FIFO: `{workspace}_sample_events.fifo`
- Content-based deduplication enabled

**SQS (Simple Queue Service):**
- 1 Main FIFO Queue: `{workspace}_sample_processor.fifo`
- 1 Dead Letter Queue (DLQ): `{workspace}_sample_processor_dlq.fifo`
- Redrive policy configured (max 3 attempts)

**Integration:**
- 1 Subscription SNS → SQS (fanout pattern)
- IAM Policy allowing SNS to send to SQS

### Adding New Resources

To add new AWS resources:
1. Create a new `.tf` file following the modular pattern (e.g., `rds.tf`, `ec2.tf`, `lambda.tf`)
2. Update `outputs.tf` with the necessary outputs (ARNs, URLs, IDs)
3. If applicable, update `iam.tf` with required permissions
4. Add environment-specific configurations in `locals.tf` if needed
5. Run `terraform fmt -recursive` to format the code
