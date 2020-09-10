// eslint-disable-next-line import/no-unresolved
const AWS = require('aws-sdk')
const { createHash } = require('crypto')
const multipart = require('./multipart')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10', region })

function generateSessionId(session) {
  return createHash('sha256').update(session).digest('hex')
}

async function uploadSession(sessionId, session) {
  const params = {
    Item: {
      sessionId: {
        S: sessionId,
      },
      session: {
        S: session,
      },
    },
    TableName: sessionTable,
  }
  return dynamodb.putItem(params).promise()
}

exports.handler = async event => {
  const data = multipart.parse(event)
  const { session } = data
  const sessionId = generateSessionId(session)
  try {
    await uploadSession(sessionId, session)
  } catch (e) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({ message: `${e}` }),
    }
    return response
  }

  const response = {
    statusCode: 200,
    body: JSON.stringify({ sessionId }),
  }
  return response
}
