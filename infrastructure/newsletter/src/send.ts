import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb'
import { SendEmailCommand } from '@aws-sdk/client-ses'
import { dynamo, ses, TABLE, FROM, API_URL } from './shared'

interface SendEvent {
  subject: string
  htmlBody: string
  textBody?: string
  dryRun?: boolean
}

interface SendResult {
  sent: number
  skipped: number
  errors: string[]
}

export async function handler(event: SendEvent): Promise<SendResult> {
  const { subject, htmlBody, textBody, dryRun = false } = event

  if (!subject || !htmlBody) {
    throw new Error('subject and htmlBody are required')
  }

  // Collect all confirmed subscribers (paginate through full table)
  const subscribers: { email: string; unsubscribeToken: string }[] = []
  let lastKey: Record<string, NativeAttributeValue> | undefined

  do {
    const result = await dynamo.send(
      new ScanCommand({
        TableName: TABLE,
        FilterExpression: '#s = :confirmed',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':confirmed': 'confirmed' },
        ExclusiveStartKey: lastKey,
      }),
    )

    for (const item of result.Items ?? []) {
      if (typeof item.email === 'string' && typeof item.unsubscribeToken === 'string') {
        subscribers.push({ email: item.email, unsubscribeToken: item.unsubscribeToken })
      }
    }

    lastKey = result.LastEvaluatedKey
  } while (lastKey)

  console.log(`${subscribers.length} confirmed subscribers (dryRun=${dryRun})`)

  if (dryRun) {
    return { sent: 0, skipped: subscribers.length, errors: [] }
  }

  const errors: string[] = []
  let sent = 0

  for (const { email, unsubscribeToken } of subscribers) {
    const unsubUrl = `${API_URL}/unsubscribe?token=${unsubscribeToken}`
    const footer = `<p style="font-size:12px;color:#888;margin-top:2em;">
      You are receiving this because you subscribed to JBrowse release announcements.
      <a href="${unsubUrl}">Unsubscribe</a>.
    </p>`
    const footerText = `\n\n---\nYou are receiving this because you subscribed to JBrowse release announcements.\nUnsubscribe: ${unsubUrl}`

    try {
      await ses.send(
        new SendEmailCommand({
          Source: FROM,
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: {
              Html: { Data: htmlBody + footer },
              ...(textBody ? { Text: { Data: textBody + footerText } } : {}),
            },
          },
        }),
      )
      sent++
      // 50ms between sends keeps well within SES production rate limits
      await new Promise<void>(resolve => { setTimeout(resolve, 50) })
    } catch (err) {
      errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  return { sent, skipped: 0, errors }
}
