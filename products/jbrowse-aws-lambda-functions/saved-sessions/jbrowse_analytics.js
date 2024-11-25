const url_parser = require('url')
const AWS = require('aws-sdk')

const dynamo = new AWS.DynamoDB.DocumentClient()

function recordStats(event, context, done) {
  const stats = { ...event.queryStringParameters }
  const headers = event.headers || {}
  // console.log(JSON.stringify(headers, null, '  '))
  stats.timestamp = Date.now()

  // get some additional stats from the connection and the headers
  stats.remoteAddress = headers['X-Forwarded-For'] || null
  stats.userAgent = headers['User-Agent'] || null
  stats.referer = headers.Referer || headers.referer || null
  stats.acceptLanguage = headers['Accept-Language'] || null
  stats.acceptCharset = headers['Accept-Charset'] || null

  stats.host = stats.referer ? url_parser.parse(stats.referer).host : null
  if (stats.host?.startsWith('www.')) {
    stats.host = stats.host.slice(4)
  }
  // stats.fullHeaders = event.headers

  // construct JSON for the track types
  const trackTypes = {}
  const trackTypesRe = /^track-types-/
  for (const key in stats) {
    if (key.startsWith('track-types-')) {
      trackTypes[key.replace(trackTypesRe, '')] = Number.parseInt(
        stats[key],
        10,
      )
      delete stats[key]
    }
  }
  stats.trackTypes = trackTypes

  stats.sessionTrackTypes = {}
  if (stats['session-tracks-count'] > 0) {
    const sessionTrackTypes = {}
    const sessionTrackTypesRe = /^sessionTrack-types-/
    for (const key in stats) {
      if (key.startsWith('sessionTrack-types-')) {
        sessionTrackTypes[key.replace(sessionTrackTypesRe, '')] =
          Number.parseInt(stats[key], 10)
        delete stats[key]
      }
    }
    stats.sessionTrackTypes = sessionTrackTypes
  }

  stats.trackTypes = trackTypes
  const tableName =
    stats.jb2 === 'true' ? 'JB2_Analytics_Events' : 'JB1_Analytics_Events'
  stats.jb2 = undefined
  const params = {
    TableName: tableName,
    Item: stats,
    ReturnConsumedCapacity: 'TOTAL',
  }
  dynamo.put(params, done)
}

exports.handler = (event, context, callback) => {
  // console.log('Received event:', JSON.stringify(event, null, 2));
  const done = err =>
    callback(null, {
      statusCode: err ? '400' : '200',
      body: err
        ? err.message
        : '\u0047\u0049\u0046\u0038\u0039\u0061\u0001\u0000\u0001\u0000\u00f0\u0001\u0000\u00ff\u00ff\u00ff\u0000\u0000\u0000\u0021\u00f9\u0004\u0001\u000a\u0000\u0000\u0000\u002c\u0000\u0000\u0000\u0000\u0001\u0000\u0001\u0000\u0000\u0002\u0002\u0044\u0001\u0000\u003b',
      headers: {
        'Content-Type': err ? 'application/json' : 'image/gif',
        'Access-Control-Allow-Origin': '*',
      },
    })

  if (event.httpMethod !== 'GET') {
    done(new Error(`Unsupported method "${event.httpMethod}"`))
  }

  recordStats(event, context, done)
}
