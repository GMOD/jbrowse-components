// eslint-disable-next-line import/no-unresolved
const AWS = require('aws-sdk')
// eslint-disable-next-line import/no-extraneous-dependencies
const { nanoid } = require('nanoid')
const multipart = require('./multipart')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new AWS.DynamoDB({ apiVersion: '2012-08-10', region })

async function uploadSession(sessionId, session, dateShared, referer) {
  const params = {
    Item: {
      sessionId: {
        S: sessionId,
      },
      session: {
        S: session,
      },
      dateShared: {
        S: dateShared,
      },
      referer: {
        S: referer,
      },
    },
    ConditionExpression: 'attribute_not_exists(sessionId)', // write once
    TableName: sessionTable,
  }
  return dynamodb.putItem(params).promise()
}

exports.handler = async event => {
  const data = multipart.parse(event)
  const { session, dateShared, referer } = data
  const sessionId = nanoid()
  try {
    await uploadSession(sessionId, session, dateShared, referer)
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
