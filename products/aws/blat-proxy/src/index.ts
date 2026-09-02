import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_DAILY_MAX,
  DEFAULT_SPACING_MS,
  MAX_CACHEABLE_BODY_BYTES,
  cacheKey,
  reserveUpstreamCall,
} from './budget.ts'
import { dynamoStore } from './dynamoStore.ts'
import { BLAT_ROUTE, routeForPath } from './routes.ts'
import { proxyStatus } from './status.ts'

import type { ProxyRoute } from './routes.ts'
import type { BlatStore } from './store.ts'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const STATUS_PATH = 'status'

// A client sending `Cache-Control: no-cache` wants an answer from UCSC itself
// rather than the table. The canary needs that: a daily probe answered from a
// 24h cache would report a broken upstream as fine. The answer is still cached,
// and the request is still metered, so this bypasses nothing that protects the
// key.
function bypassesCache(headers: Record<string, string | undefined>) {
  return /no-cache/i.test(headers['cache-control'] ?? '')
}

function json(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

// hgBlat answers JSON and hgPcr answers an HTML page of FASTA amplicons, so the
// content type is the route's, not a constant
function upstreamBody(
  body: string,
  route: ProxyRoute,
  cache: 'hit' | 'miss',
): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': route.contentType,
      'X-Blat-Cache': cache,
    },
    body,
  }
}

function envNumber(name: string, fallback: number) {
  const raw = process.env[name]
  const parsed = raw === undefined ? Number.NaN : Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

// One client per container, reused across invocations
let sharedStore: BlatStore | undefined
function storeFromEnv() {
  const tableName = process.env.BLAT_LIMIT_TABLE
  if (tableName && !sharedStore) {
    sharedStore = dynamoStore(tableName)
  }
  return tableName ? sharedStore : undefined
}

/**
 * Serves one validated query against a UCSC CGI, spending the shared key's
 * budget only when it has to.
 *
 * `store` is what makes the proxy safe to expose: the apiKey is shared by every
 * browser user, and UCSC's cap belongs to the key, not to the caller — one hit
 * per 15s and 5000 a day across the Genome Browser CGIs, not per CGI. So both
 * routes claim from the SAME budget; giving hgPcr its own would spend twice the
 * cap on one key. Without a store the proxy is unmetered — fine for a local
 * run, not for a deployment.
 */
export async function serveQuery({
  clientBody,
  apiKey,
  upstreamUrl,
  route = BLAT_ROUTE,
  store,
  nowMs = Date.now(),
  bypassCache = false,
}: {
  clientBody: string
  apiKey: string
  upstreamUrl: string
  route?: ProxyRoute
  store?: BlatStore
  nowMs?: number
  bypassCache?: boolean
}): Promise<APIGatewayProxyResultV2> {
  // the route is part of the key: the two CGIs take different parameters, but
  // nothing structural stops a body from being valid for both
  const key = cacheKey(clientBody, route.name)
  const nowSeconds = Math.floor(nowMs / 1000)
  const cacheTtl = envNumber(
    'BLAT_CACHE_TTL_SECONDS',
    DEFAULT_CACHE_TTL_SECONDS,
  )
  // a cache failure is a slow path, not a broken one
  const cached =
    store && !bypassCache
      ? await store.readCached(key, nowSeconds).catch((error: unknown) => {
          console.error('BLAT cache read failed:', error)
          return undefined
        })
      : undefined

  let result: APIGatewayProxyResultV2
  if (cached) {
    result = upstreamBody(cached, route, 'hit')
  } else {
    // Fails CLOSED: if the budget can't be checked, the request doesn't go
    // through. An unmetered burst risks the one key every user shares, which is
    // a worse outcome than a query that has to be retried.
    const denial = store
      ? await reserveUpstreamCall({
          store,
          nowMs,
          spacingMs: envNumber('BLAT_SPACING_MS', DEFAULT_SPACING_MS),
          dailyMax: envNumber('BLAT_DAILY_MAX', DEFAULT_DAILY_MAX),
        }).catch((error: unknown) => {
          console.error('BLAT budget check failed:', error)
          return {
            reason: 'The BLAT proxy could not verify its rate budget.',
            retryAfterSeconds: 30,
          }
        })
      : undefined

    if (denial) {
      result = json(
        429,
        { error: denial.reason, retryAfterSeconds: denial.retryAfterSeconds },
        { 'Retry-After': String(denial.retryAfterSeconds) },
      )
    } else {
      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: route.buildBody(clientBody, apiKey),
      })
      const text = await upstream.text()
      const rejectReason = upstream.ok ? route.rejectReason(text) : undefined
      if (!upstream.ok) {
        result = json(502, {
          error: `${route.name} upstream responded ${upstream.status}`,
          detail: text.slice(0, 500),
        })
      } else if (rejectReason) {
        result = json(502, { error: rejectReason })
      } else {
        if (store && text.length <= MAX_CACHEABLE_BODY_BYTES) {
          await store
            .writeCached(key, text, nowSeconds + cacheTtl)
            .catch((error: unknown) => {
              console.error('BLAT cache write failed:', error)
            })
        }
        result = upstreamBody(text, route, 'miss')
      }
    }
  }
  return result
}

export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method
  const apiKey = process.env.UCSC_API_KEY
  // an unrecognized path can only reach here if the template routes one, so
  // treat blat as the default rather than 404-ing a working deployment
  const route = routeForPath(event.requestContext.http.path) ?? BLAT_ROUTE
  const upstreamUrl =
    process.env[route.upstreamEnvVar] ?? route.defaultUpstreamUrl

  const path = event.requestContext.http.path
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
  } else if (method === 'GET' && path.endsWith(`/${STATUS_PATH}`)) {
    return json(
      200,
      await proxyStatus({
        store: storeFromEnv(),
        nowMs: Date.now(),
        dailyMax: envNumber('BLAT_DAILY_MAX', DEFAULT_DAILY_MAX),
      }),
      { 'Cache-Control': 'no-store' },
    )
  } else if (method !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST' })
  } else if (!apiKey) {
    console.error('UCSC_API_KEY is not configured')
    return json(500, {
      error: 'BLAT proxy is missing its UCSC apiKey (UCSC_API_KEY unset)',
    })
  } else {
    const clientBody =
      event.isBase64Encoded && event.body
        ? new TextDecoder().decode(
            Uint8Array.from(atob(event.body), char => char.charCodeAt(0)),
          )
        : (event.body ?? '')
    const invalidReason = route.validate(clientBody)

    if (invalidReason) {
      return json(400, {
        error: `Invalid ${route.name} request: ${invalidReason}`,
      })
    } else {
      try {
        return await serveQuery({
          clientBody,
          apiKey,
          upstreamUrl,
          route,
          store: storeFromEnv(),
          bypassCache: bypassesCache(event.headers),
        })
      } catch (error) {
        console.error('BLAT proxy request failed:', error)
        return json(500, {
          error: 'BLAT proxy request failed',
          message: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }
}
