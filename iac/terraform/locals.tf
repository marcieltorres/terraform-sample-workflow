locals {
  # Constants
  application_name = "sample-app"
  name_prefix      = "${terraform.workspace}_sample"

  # SQS Configuration - values per environment
  sqs_config = {
    dev = {
      message_retention_seconds  = 86400  # 1 day
      visibility_timeout_seconds = 30     # 30 seconds
      dlq_retention_seconds      = 345600 # 4 days
      max_receive_count          = 3
    }
    staging = {
      message_retention_seconds  = 259200 # 3 days
      visibility_timeout_seconds = 45     # 45 seconds
      dlq_retention_seconds      = 604800 # 7 days
      max_receive_count          = 3
    }
    prod = {
      message_retention_seconds  = 604800  # 7 days
      visibility_timeout_seconds = 60      # 60 seconds
      dlq_retention_seconds      = 1209600 # 14 days
      max_receive_count          = 3
    }
    default = {
      message_retention_seconds  = 86400  # 1 day
      visibility_timeout_seconds = 30     # 30 seconds
      dlq_retention_seconds      = 345600 # 4 days
      max_receive_count          = 3
    }
  }

  # Select config based on workspace (uses default if not found)
  current_sqs_config = lookup(local.sqs_config, terraform.workspace, local.sqs_config.default)

  # Common tags
  common_tags = {
    Environment = terraform.workspace
    Service     = local.application_name
    ManagedBy   = "terraform"
    Owner       = "platform-team"
  }
}
