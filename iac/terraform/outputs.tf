# SNS
output "sns_topic_arn" {
  description = "SNS topic ARN"
  value       = aws_sns_topic.events.arn
}

output "sns_topic_name" {
  description = "SNS topic name"
  value       = aws_sns_topic.events.name
}

# SQS - Processor
output "sqs_processor_url" {
  description = "Processor queue URL"
  value       = aws_sqs_queue.processor.url
}

output "sqs_processor_arn" {
  description = "Processor queue ARN"
  value       = aws_sqs_queue.processor.arn
}

# DLQ
output "dlq_processor_url" {
  description = "Processor DLQ URL"
  value       = aws_sqs_queue.processor_dlq.url
}

output "dlq_processor_arn" {
  description = "Processor DLQ ARN"
  value       = aws_sqs_queue.processor_dlq.arn
}
