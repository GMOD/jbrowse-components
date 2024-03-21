const AWS = require('aws-sdk')
const { createHash } = require('crypto')
const multipart = require('./multipart')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10', region })

// slice of session hash in base64, add a math.random so that same session maps
// to new id
function generateSessionId(session) {
  return createHash('sha256')
    .update(session + Math.random())
    .digest('base64')
    .slice(0, 10)
    .replace('+', '-')
    .replace('/', '_')
    .replace(/=+$/, '')
}

async function uploadSession(sessionId, session, dateShared, referer) {
  const params = {
    ConditionExpression: 'attribute_not_exists(sessionId)',
    Item: {
      dateShared: {
        S: dateShared,
      },
      referer: {
        S: referer,
      },
      session: {
        S: session,
      },
      sessionId: {
        S: sessionId,
      },
    }, // write once
    TableName: sessionTable,
  }
  return dynamodb.putItem(params).promise()
}

exports.handler = async event => {
  const data = multipart.parse(event)
  const { session, dateShared, referer } = data
  const sessionId = generateSessionId(session)
  try {
    await uploadSession(sessionId, session, dateShared, referer)
  } catch (e) {
    const response = {
      body: JSON.stringify({ message: `${e}` }),
      statusCode: 400,
    }
    return response
  }

  const response = {
    body: JSON.stringify({ sessionId }),
    statusCode: 200,
  }
  return response
}
