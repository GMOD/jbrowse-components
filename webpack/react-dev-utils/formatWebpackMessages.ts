function formatMessage(message: string | { message: string }) {
  if (typeof message === 'string') {
    return message
  }
  if ('message' in message) {
    return message.message
  }
  return String(message)
}

export default function formatWebpackMessages(json: {
  errors: (string | { message: string })[]
  warnings: (string | { message: string })[]
}) {
  return {
    errors: json.errors.map(formatMessage),
    warnings: json.warnings.map(formatMessage),
  }
}
