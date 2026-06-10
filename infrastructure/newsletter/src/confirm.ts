import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

import { TABLE, dynamo, htmlResponse, responsePage } from './shared.ts'

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const token = event.queryStringParameters?.token

  if (!token) {
    return htmlResponse(
      400,
      responsePage('Error', 'Missing confirmation token.', '#c0392b'),
    )
  }

  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'confirmToken-index',
      KeyConditionExpression: 'confirmToken = :token',
      ExpressionAttributeValues: { ':token': token },
    }),
  )

  const item = result.Items?.[0]

  if (!item) {
    return htmlResponse(
      404,
      responsePage('Error', 'Invalid or expired confirmation link.', '#c0392b'),
    )
  }

  if (item.status === 'confirmed') {
    return htmlResponse(
      200,
      responsePage(
        'Already Subscribed',
        'You are already subscribed!',
        '#2d7a57',
      ),
    )
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { email: item.email },
      UpdateExpression: 'SET #s = :confirmed, confirmedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':confirmed': 'confirmed',
        ':now': new Date().toISOString(),
      },
    }),
  )

  return htmlResponse(
    200,
    responsePage(
      'Subscription Confirmed',
      "You're subscribed! You'll receive JBrowse release announcements.",
      '#2d7a57',
    ),
  )
}
