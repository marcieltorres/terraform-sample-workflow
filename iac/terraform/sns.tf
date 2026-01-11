resource "aws_sns_topic" "events" {
  name                        = "${local.name_prefix}_events.fifo"
  fifo_topic                  = true
  content_based_deduplication = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}_events.fifo"
      Type = "SNS-FIFO"
    }
  )
}
