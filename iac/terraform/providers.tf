terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket               = "my-terraform-state-bucket"
    key                  = "sample-app/terraform.tfstate"
    workspace_key_prefix = "env"
    region               = "us-east-1"
    encrypt              = true
  }
}

provider "aws" {
  region = var.aws_region
}
