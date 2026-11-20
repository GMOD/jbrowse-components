import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

import { buildEmail, parseReport } from './email.mjs'

const ses = new SESv2Client({ maxAttempts: 2 })
const route = { from: process.env.FROM_ADDRESS, to: process.env.TO_ADDRESS }

function reply(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export async function handler(event) {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body ?? '', 'base64').toString('utf8')
    : event.body
  const fields = parseReport(body)
  if (!fields) {
    return reply(400, { error: 'The request has no report' })
  }
  console.log(JSON.stringify(fields))
  await ses.send(new SendEmailCommand(buildEmail(fields, route)))
  return reply(200, { ok: true })
}
