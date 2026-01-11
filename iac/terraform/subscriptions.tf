# Subscription: SNS -> SQS Processor
resource "aws_sns_topic_subscription" "processor" {
  topic_arn = aws_sns_topic.events.arn
  protocol  = "sqs"
  endpoint  = aws_sqs_queue.processor.arn

  raw_message_delivery = true
}
