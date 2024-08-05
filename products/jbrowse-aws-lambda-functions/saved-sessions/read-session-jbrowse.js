const AWS = require('aws-sdk')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region,
})

function readSession(sessionId) {
  const params = {
    TableName: sessionTable,
    Key: { sessionId },
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
      statusCode: 500,
      body: JSON.stringify({ message: `${e}` }),
    }
  }

  const sessionObj = tableData.Item
  if (!sessionObj) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Session not found' }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify(sessionObj),
  }
}
