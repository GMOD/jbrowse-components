// eslint-disable-next-line import/no-unresolved
const AWS = require('aws-sdk')
const multipart = require('./multipart')

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
  const data = multipart.parse(event)
  const { sessionId } = data
  let tableData
  try {
    tableData = await readSession(sessionId)
  } catch (e) {
    const response = {
      statusCode: 400,
      body: JSON.stringify({ message: `Session not found. ${e}` }),
    }
    return response
  }

  const { session } = tableData.Item
  const response = {
    statusCode: 200,
    body: JSON.stringify({ session }),
  }
  return response
}
