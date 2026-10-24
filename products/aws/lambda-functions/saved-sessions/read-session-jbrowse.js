const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb')

const { AWS_REGION: region, sessionTable } = process.env

const dynamodb = new DynamoDBClient({ region })

function readSession(sessionId) {
  return dynamodb.send(
    new GetItemCommand({
      TableName: sessionTable,
      Key: { sessionId: { S: sessionId } },
    }),
  )
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

  const item = tableData.Item
  if (!item) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Session not found' }),
    }
  }

  // every attribute is a string
  const sessionObj = Object.fromEntries(
    Object.entries(item).map(([key, value]) => [key, value.S]),
  )
  return {
    statusCode: 200,
    body: JSON.stringify(sessionObj),
  }
}
