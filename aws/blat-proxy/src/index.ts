import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_DAILY_MAX,
  DEFAULT_SPACING_MS,
  MAX_CACHEABLE_BODY_BYTES,
  cacheKey,
  reserveUpstreamCall,
} from './budget.ts'
import { dynamoStore } from './dynamoStore.ts'
import {
  DEFAULT_UPSTREAM_URL,
  buildUpstreamBody,
  looksLikeHtml,
  validateClientBody,
} from './proxy.ts'

import type { BlatStore } from './store.ts'
import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function blatJson(body: string, cache: 'hit' | 'miss'): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
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
 * Serves one validated BLAT query, spending the shared key's budget only when
 * it has to.
 *
 * `store` is what makes the proxy safe to expose: the apiKey is shared by every
 * browser user, and UCSC's cap belongs to the key, not to the caller. Without a
 * store the proxy is unmetered — fine for a local run, not for a deployment.
 */
export async function serveQuery({
  clientBody,
  apiKey,
  upstreamUrl,
  store,
  nowMs = Date.now(),
}: {
  clientBody: string
  apiKey: string
  upstreamUrl: string
  store?: BlatStore
  nowMs?: number
}): Promise<APIGatewayProxyResultV2> {
  const key = cacheKey(clientBody)
  const nowSeconds = Math.floor(nowMs / 1000)
  const cacheTtl = envNumber('BLAT_CACHE_TTL_SECONDS', DEFAULT_CACHE_TTL_SECONDS)
  // a cache failure is a slow path, not a broken one
  const cached = store
    ? await store.readCached(key, nowSeconds).catch((error: unknown) => {
        console.error('BLAT cache read failed:', error)
        return undefined
      })
    : undefined

  let result: APIGatewayProxyResultV2
  if (cached) {
    result = blatJson(cached, 'hit')
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
        body: buildUpstreamBody(clientBody, apiKey),
      })
      const text = await upstream.text()
      if (!upstream.ok) {
        result = json(502, {
          error: `hgBlat responded ${upstream.status}`,
          detail: text.slice(0, 500),
        })
      } else if (looksLikeHtml(text)) {
        result = json(502, {
          error:
            'hgBlat returned HTML (CAPTCHA challenge or error page) instead ' +
            'of JSON — the apiKey may be invalid or rate-limited',
        })
      } else {
        if (store && text.length <= MAX_CACHEABLE_BODY_BYTES) {
          await store
            .writeCached(key, text, nowSeconds + cacheTtl)
            .catch((error: unknown) => {
              console.error('BLAT cache write failed:', error)
            })
        }
        result = blatJson(text, 'miss')
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
  const upstreamUrl = process.env.BLAT_UPSTREAM_URL ?? DEFAULT_UPSTREAM_URL

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' }
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
    const invalidReason = validateClientBody(clientBody)

    if (invalidReason) {
      return json(400, { error: `Invalid BLAT request: ${invalidReason}` })
    } else {
      try {
        return await serveQuery({
          clientBody,
          apiKey,
          upstreamUrl,
          store: storeFromEnv(),
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
