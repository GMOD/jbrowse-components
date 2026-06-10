import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { SendEmailCommand } from '@aws-sdk/client-ses'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { randomUUID } from 'crypto'
import { dynamo, ses, TABLE, FROM, API_URL, jsonResponse, isValidEmail } from './shared'

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  const email = String(body.email ?? '').trim().toLowerCase()

  if (!isValidEmail(email)) {
    return jsonResponse(400, { error: 'Invalid email address.' })
  }

  const existing = await dynamo.send(new GetCommand({ TableName: TABLE, Key: { email } }))

  if (existing.Item?.status === 'confirmed') {
    return jsonResponse(200, { message: 'Already subscribed!' })
  }

  const confirmToken = randomUUID()
  const unsubscribeToken = randomUUID()

  await dynamo.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        email,
        status: 'pending',
        confirmToken,
        unsubscribeToken,
        subscribedAt: new Date().toISOString(),
      },
    }),
  )

  const confirmUrl = `${API_URL}/confirm?token=${confirmToken}`

  try {
    await ses.send(
      new SendEmailCommand({
        Source: FROM,
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: 'Confirm your JBrowse newsletter subscription' },
          Body: {
            Html: {
              Data: `
                <p>Thanks for subscribing to the JBrowse release newsletter!</p>
                <p>Click below to confirm your subscription:</p>
                <p><a href="${confirmUrl}">${confirmUrl}</a></p>
                <p style="color:#888;font-size:12px;">If you did not request this, you can ignore this email.</p>
              `,
            },
            Text: {
              Data: `Thanks for subscribing to the JBrowse newsletter!\n\nConfirm your subscription:\n${confirmUrl}\n\nIf you did not request this, ignore this email.`,
            },
          },
        },
      }),
    )
  } catch (err) {
    console.error('SES send failed:', err)
    return jsonResponse(500, { error: 'Failed to send confirmation email. Please try again later.' })
  }

  return jsonResponse(200, { message: 'Check your email to confirm your subscription.' })
}
