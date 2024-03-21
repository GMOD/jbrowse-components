const AWS = require('aws-sdk')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region,
})

function readSession(sessionId) {
  const params = {
    Key: { sessionId },
    TableName: sessionTable,
  }
  return dynamodb.get(params).promise()
}

exports.handler = async event => {
  const data = event.queryStringParameters
  let { sessionId } = data
  let tableData

  // workaround for '+' character being encoded by api gateway (?) as space, xref
  // https://github.com/GMOD/jbrowse-components/pull/3524
  sessionId = sessionId.replaceAll(' ', '+')
  try {
    tableData = await readSession(sessionId)
  } catch (e) {
    return {
      body: JSON.stringify({ message: `${e}` }),
      statusCode: 500,
    }
  }

  const sessionObj = tableData.Item
  if (!sessionObj) {
    return {
      body: JSON.stringify({ message: `Session not found` }),
      statusCode: 404,
    }
  }

  return {
    body: JSON.stringify(sessionObj),
    statusCode: 200,
  }
}
