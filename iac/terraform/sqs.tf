# DLQ - Dead Letter Queue
resource "aws_sqs_queue" "processor_dlq" {
  name                        = "${local.name_prefix}_processor_dlq.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = local.current_sqs_config.dlq_retention_seconds

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}_processor_dlq.fifo"
      Type = "SQS-FIFO-DLQ"
    }
  )
}

# Main Queue - Processor
resource "aws_sqs_queue" "processor" {
  name                        = "${local.name_prefix}_processor.fifo"
  fifo_queue                  = true
  content_based_deduplication = true
  message_retention_seconds   = local.current_sqs_config.message_retention_seconds
  visibility_timeout_seconds  = local.current_sqs_config.visibility_timeout_seconds

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.processor_dlq.arn
    maxReceiveCount     = local.current_sqs_config.max_receive_count
  })

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}_processor.fifo"
      Type = "SQS-FIFO"
    }
  )
}
