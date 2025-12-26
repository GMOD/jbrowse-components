'use strict'

function formatMessage(message) {
  if (typeof message === 'string') {
    return message
  }
  if ('message' in message) {
    return message.message
  }
  return String(message)
}

function formatWebpackMessages(json) {
  return {
    errors: json.errors.map(formatMessage),
    warnings: json.warnings.map(formatMessage),
  }
}

module.exports = formatWebpackMessages
