import { DEFAULT_UPSTREAM_URL, buildUpstreamBody, looksLikeHtml } from './proxy.ts'

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from 'aws-lambda'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
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
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : (event.body ?? '')

    try {
      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: buildUpstreamBody(clientBody, apiKey),
      })
      const text = await upstream.text()
      if (!upstream.ok) {
        return json(502, {
          error: `hgBlat responded ${upstream.status}`,
          detail: text.slice(0, 500),
        })
      } else if (looksLikeHtml(text)) {
        return json(502, {
          error:
            'hgBlat returned HTML (CAPTCHA challenge or error page) instead ' +
            'of JSON — the apiKey may be invalid or rate-limited',
        })
      } else {
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          body: text,
        }
      }
    } catch (error) {
      console.error('BLAT proxy request failed:', error)
      return json(500, {
        error: 'BLAT proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
