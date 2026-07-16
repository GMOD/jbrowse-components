import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { handler } from '../src/index.ts'

import type { APIGatewayProxyEventV2 } from 'aws-lambda'

// Minimal-but-complete v2 (HTTP API payload format 2.0) event. The handler only
// reads method / body / isBase64Encoded, but building the full shape keeps this
// honest about the payload version the deployed HttpApi actually sends.
function makeEvent({
  method = 'POST',
  body,
  isBase64Encoded = false,
}: {
  method?: string
  body?: string
  isBase64Encoded?: boolean
} = {}): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: `${method} /blat`,
    rawPath: '/blat',
    rawQueryString: '',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    requestContext: {
      accountId: '123456789012',
      apiId: 'api',
      domainName: 'api.execute-api.us-east-1.amazonaws.com',
      domainPrefix: 'api',
      http: {
        method,
        path: '/blat',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'req',
      routeKey: `${method} /blat`,
      stage: 'prod',
      time: '01/Jan/2024:00:00:00 +0000',
      timeEpoch: 0,
    },
    body,
    isBase64Encoded,
  }
}

// The handler returns APIGatewayProxyResultV2, which is `string | structured`;
// every path here returns the structured form, so narrow to it for assertions.
function structured(result: Awaited<ReturnType<typeof handler>>) {
  if (typeof result === 'string') {
    throw new Error('expected a structured result, got a string')
  }
  return result
}

const VALID_BODY = 'userSeq=ACGTACGT&type=DNA&db=hg38'

beforeEach(() => {
  process.env.UCSC_API_KEY = 'SECRET'
  delete process.env.BLAT_UPSTREAM_URL
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('handler', () => {
  it('answers a CORS preflight without hitting upstream', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = structured(await handler(makeEvent({ method: 'OPTIONS' })))
    expect(result.statusCode).toBe(200)
    expect(result.headers?.['Access-Control-Allow-Origin']).toBe('*')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('rejects non-POST methods with 405', async () => {
    const result = structured(await handler(makeEvent({ method: 'GET' })))
    expect(result.statusCode).toBe(405)
  })

  it('returns 500 when the apiKey is not configured', async () => {
    delete process.env.UCSC_API_KEY
    const result = structured(await handler(makeEvent({ body: VALID_BODY })))
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body ?? '').error).toMatch(/UCSC_API_KEY/)
  })

  it('rejects an invalid body with 400 before hitting upstream', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const result = structured(await handler(makeEvent({ body: 'db=hg38' })))
    expect(result.statusCode).toBe(400)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('injects the apiKey + json output and relays a JSON response', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('{"blat":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    const result = structured(await handler(makeEvent({ body: VALID_BODY })))

    expect(result.statusCode).toBe(200)
    expect(result.body).toBe('{"blat":[]}')
    expect(result.headers?.['Content-Type']).toBe('application/json')

    const [url, init] = fetchSpy.mock.calls[0]
    expect(url).toBe('https://genome.ucsc.edu/cgi-bin/hgBlat')
    const sent = new URLSearchParams(init.body)
    expect(sent.get('apiKey')).toBe('SECRET')
    expect(sent.get('output')).toBe('json')
    expect(sent.get('userSeq')).toBe('ACGTACGT')
  })

  it('decodes a base64-encoded body', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response('{"blat":[]}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)

    await handler(
      makeEvent({
        body: btoa(VALID_BODY),
        isBase64Encoded: true,
      }),
    )

    const sent = new URLSearchParams(fetchSpy.mock.calls[0][1].body)
    expect(sent.get('userSeq')).toBe('ACGTACGT')
  })

  it('relays an upstream non-2xx as a 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('boom', { status: 503 })),
    )
    const result = structured(await handler(makeEvent({ body: VALID_BODY })))
    expect(result.statusCode).toBe(502)
    expect(JSON.parse(result.body ?? '').error).toMatch(/503/)
  })

  it('turns an HTML (Turnstile) response into a 502', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('<!DOCTYPE html>', { status: 200 })),
    )
    const result = structured(await handler(makeEvent({ body: VALID_BODY })))
    expect(result.statusCode).toBe(502)
    expect(JSON.parse(result.body ?? '').error).toMatch(/HTML/)
  })

  it('returns 500 when the upstream fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const result = structured(await handler(makeEvent({ body: VALID_BODY })))
    expect(result.statusCode).toBe(500)
    expect(JSON.parse(result.body ?? '').message).toBe('network down')
  })
})
