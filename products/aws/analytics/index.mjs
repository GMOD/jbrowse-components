import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

// Two attempts of at most 1s connect plus 2s response stay well inside the
// Lambda's 10s timeout
const clientConfig = {
  maxAttempts: 2,
  requestHandler: {
    connectionTimeout: 1000,
    requestTimeout: 2000,
    throwOnRequestTimeout: true,
  },
}
const firehose = new FirehoseClient(clientConfig)
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig))

const streams = { jb1: process.env.JB1_STREAM, jb2: process.env.JB2_STREAM }
const tables = { jb1: 'JB1_Analytics_Events', jb2: 'JB2_Analytics_Events' }
const writeDynamo = process.env.WRITE_DYNAMO === 'true'

const gif =
  'GIF89a\u0001\u0000\u0001\u0000ð\u0001\u0000ÿÿÿ\u0000\u0000\u0000!ù\u0004\u0001\u000a\u0000\u0000\u0000,\u0000\u0000\u0000\u0000\u0001\u0000\u0001\u0000\u0000\u0002\u0002D\u0001\u0000;'

function response(error) {
  return {
    statusCode: error ? '400' : '200',
    body: error ?? gif,
    headers: {
      'Content-Type': error ? 'application/json' : 'image/gif',
      'Access-Control-Allow-Origin': '*',
    },
  }
}

function takeCounts(stats, prefix) {
  const counts = {}
  for (const key of Object.keys(stats)) {
    if (key.startsWith(prefix)) {
      counts[key.slice(prefix.length)] = Number.parseInt(stats[key], 10)
      delete stats[key]
    }
  }
  return counts
}

function refererHost(referer) {
  if (!referer || !URL.canParse(referer)) {
    return null
  }
  const { host } = new URL(referer)
  return host.startsWith('www.') ? host.slice(4) : host
}

export function buildStats(event, now = Date.now()) {
  const stats = { ...event.queryStringParameters }
  const headers = event.headers || {}
  const product = stats.jb2 === 'true' ? 'jb2' : 'jb1'
  delete stats.jb2

  stats.timestamp = now
  stats.remoteAddress = headers['X-Forwarded-For'] || null
  stats.userAgent = headers['User-Agent'] || null
  stats.referer = headers.Referer || headers.referer || null
  stats.acceptLanguage = headers['Accept-Language'] || null
  stats.acceptCharset = headers['Accept-Charset'] || null
  stats.host = refererHost(stats.referer)
  stats.trackTypes = takeCounts(stats, 'track-types-')
  stats.sessionTrackTypes =
    stats['session-tracks-count'] > 0
      ? takeCounts(stats, 'sessionTrack-types-')
      : {}

  return { product, stats }
}

export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return response(`Unsupported method "${event.httpMethod}"`)
  }
  const { product, stats } = buildStats(event)

  const writes = [
    firehose.send(
      new PutRecordCommand({
        DeliveryStreamName: streams[product],
        Record: { Data: Buffer.from(`${JSON.stringify(stats)}\n`) },
      }),
    ),
  ]
  if (writeDynamo) {
    writes.push(
      dynamo.send(new PutCommand({ TableName: tables[product], Item: stats })),
    )
  }

  const failures = (await Promise.allSettled(writes)).filter(
    result => result.status === 'rejected',
  )
  for (const failure of failures) {
    console.error(failure.reason)
  }
  return failures.length === writes.length
    ? response(failures[0].reason.message)
    : response()
}
