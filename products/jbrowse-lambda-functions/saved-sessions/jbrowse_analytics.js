// eslint-disable-next-line import/no-unresolved
const AWS = require('aws-sdk')
const urlParser = require('url')

const dynamo = new AWS.DynamoDB.DocumentClient()

function recordStats(event, context, done) {
  const stats = event.queryStringParameters
    ? { ...event.queryStringParameters }
    : JSON.parse(event.body)
  const headers = event.headers || {}
  // console.log(JSON.stringify(headers, null, '  '))
  stats.timestamp = Date.now()

  // get some additional stats from the connection and the headers
  stats.remoteAddress = headers['X-Forwarded-For'] || null
  stats.userAgent = headers['User-Agent'] || null
  stats.referer = headers.Referer || headers.referer || null
  stats.acceptLanguage = headers['Accept-Language'] || null
  stats.acceptCharset = headers['Accept-Charset'] || null
  stats.host = stats.referer ? urlParser.parse(stats.referer).host : null
  if (stats.host && stats.host.startsWith('www.'))
    stats.host = stats.host.slice(4)
  // stats.fullHeaders = event.headers

  // construct JSON for the track types
  const trackTypes = {}
  const trackTypesRe = /^track-types-/
  for (const key in stats) {
    if (trackTypesRe.test(key)) {
      // eslint-disable-next-line radix
      trackTypes[key.replace(trackTypesRe, '')] = parseInt(stats[key])
    }
  }

  stats.trackTypes = trackTypes
  const params = {
    TableName: 'JB2_Analytical_Events',
    Item: stats,
    ReturnConsumedCapacity: 'TOTAL',
  }
  // console.log(JSON.stringify(stats, null, '  '))
  dynamo.put(params, done)
  // dynamo.putItem({ Item: stats, TableName: 'JB2_Analytical_Events', ReturnConsumedCapacity: "TOTAL" }, done)
}

exports.handler = (event, context, callback) => {
  // console.log('Received event:', JSON.stringify(event, null, 2));

  const done = (err, res) =>
    callback(null, {
      statusCode: err ? '400' : '200',
      body: err
        ? err.message
        : '\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\xf0\x01\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x0a\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b',
      headers: {
        'Content-Type': err ? 'application/json' : 'image/gif',
        'Access-Control-Allow-Origin': '*',
      },
    })

  // const method = event.requestContext.http.method
  // console.log(method)
  // if (!method.includes('GET') || !method.includes('POST')) {
  //     done(new Error(`Unsupported method "${method}"`));
  // }

  recordStats(event, context, done)
}
