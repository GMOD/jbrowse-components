import { QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda'
import { dynamo, TABLE, htmlResponse, responsePage } from './shared'

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  const token = event.queryStringParameters?.token

  if (!token) {
    return htmlResponse(400, responsePage('Error', 'Missing unsubscribe token.', '#c0392b'))
  }

  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'unsubscribeToken-index',
      KeyConditionExpression: 'unsubscribeToken = :token',
      ExpressionAttributeValues: { ':token': token },
    }),
  )

  const item = result.Items?.[0]

  if (!item) {
    return htmlResponse(404, responsePage('Error', 'Invalid unsubscribe link.', '#c0392b'))
  }

  if (item.status === 'unsubscribed') {
    return htmlResponse(
      200,
      responsePage('Already Unsubscribed', 'You have already unsubscribed.', '#2d7a57'),
    )
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { email: item.email },
      UpdateExpression: 'SET #s = :unsubscribed',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':unsubscribed': 'unsubscribed' },
    }),
  )

  return htmlResponse(
    200,
    responsePage(
      'Unsubscribed',
      "You've been unsubscribed from JBrowse release announcements.",
      '#2d7a57',
    ),
  )
}
