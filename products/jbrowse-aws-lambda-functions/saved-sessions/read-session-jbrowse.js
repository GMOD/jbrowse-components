const AWS = require('aws-sdk')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region,
})

async function readSession(sessionId) {
  const params = {
    TableName: sessionTable,
    Key: { sessionId },
  }
  return dynamodb.get(params).promise()
}

exports.handler = async event => {
  const data = event.queryStringParameters
  const { sessionId } = data
  let tableData
  try {
    tableData = await readSession(sessionId)
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `${e}` }),
    }
  }

  const sessionObj = tableData.Item
  if (!sessionObj) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: `Session not found` }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(sessionObj),
  }
}
