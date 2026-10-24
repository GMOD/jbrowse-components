const { createHash } = require('crypto')

const {
  ConditionalCheckFailedException,
  DynamoDBClient,
  PutItemCommand,
} = require('@aws-sdk/client-dynamodb')

const multipart = require('./multipart.js')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new DynamoDBClient({ region })

// slice of session hash in base64, add a math.random so that same session maps
// to new id
function generateSessionId(session) {
  return createHash('sha256')
    .update(session + Math.random())
    .digest('base64')
    .slice(0, 10)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')
}

// The client offers a hash of the key its link carries, so the link needs only
// the key. Write-once below keeps an offered id from replacing a stored session.
function offeredSessionId(sessionId) {
  return typeof sessionId === 'string' && /^[\w-]{16,64}$/.test(sessionId)
    ? sessionId
    : undefined
}

function uploadSession(sessionId, session, dateShared, referer) {
  return dynamodb.send(
    new PutItemCommand({
      Item: {
        sessionId: { S: sessionId },
        session: { S: session },
        dateShared: { S: dateShared },
        referer: { S: referer },
      },
      ConditionExpression: 'attribute_not_exists(sessionId)', // write once
      TableName: sessionTable,
    }),
  )
}

exports.handler = async event => {
  const data = multipart.parse(event)
  const { session, dateShared, referer } = data
  const sessionId =
    offeredSessionId(data.sessionId) ?? generateSessionId(session)
  try {
    await uploadSession(sessionId, session, dateShared, referer)
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message:
          e instanceof ConditionalCheckFailedException
            ? 'A session is already stored under that id'
            : `${e}`,
      }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sessionId }),
  }
}
