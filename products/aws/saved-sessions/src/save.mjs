import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb'

import { saveSession } from './sessions.mjs'

const dynamodb = new DynamoDBClient({})

export const handler = event =>
  saveSession(event, Item =>
    dynamodb.send(
      new PutItemCommand({
        TableName: process.env.sessionTable,
        Item,
        ConditionExpression: 'attribute_not_exists(sessionId)',
      }),
    ),
  )
