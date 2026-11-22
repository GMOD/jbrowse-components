import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'

import { readSession } from './sessions.mjs'

const dynamodb = new DynamoDBClient({})

export const handler = event =>
  readSession(event, async sessionId => {
    const { Item } = await dynamodb.send(
      new GetItemCommand({
        TableName: process.env.sessionTable,
        Key: { sessionId: { S: sessionId } },
      }),
    )
    return Item
  })
