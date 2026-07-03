import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// UCSC hgBlat with output=json returns a fixed set of PSL columns plus the
// field-name array describing them. See
// https://genome.ucsc.edu/cgi-bin/hgBlat
interface BlatJsonResponse {
  fields: string[]
  blat: (string | number)[][]
  genome?: string
}

// PSL packs the per-block coordinates as comma-separated lists with a trailing
// comma, e.g. "31,101,13,"
function parseCommaList(value: string | number) {
  return String(value).split(',').filter(Boolean).map(Number)
}

function pslRowToFeature(
  row: (string | number)[],
  col: Record<string, number>,
  featureIndex: number,
): SimpleFeatureSerialized {
  const get = (name: string): string | number => row[col[name]!] ?? ''
  const refName = String(get('tName'))
  const start = Number(get('tStart'))
  const end = Number(get('tEnd'))
  const strand = String(get('strand')).startsWith('-') ? -1 : 1
  const qName = String(get('qName'))
  const matches = Number(get('matches'))
  const misMatches = Number(get('misMatches'))
  const repMatches = Number(get('repMatches'))
  const qNumInsert = Number(get('qNumInsert'))
  const tNumInsert = Number(get('tNumInsert'))
  const blockSizes = parseCommaList(get('blockSizes'))
  const tStarts = parseCommaList(get('tStarts'))

  // UCSC's simplified pslScore
  const score = matches + repMatches - misMatches - qNumInsert - tNumInsert
  const aligned = matches + repMatches + misMatches
  const identity = aligned > 0 ? (100 * (matches + repMatches)) / aligned : 0

  const uniqueId = `blat-${featureIndex}`
  const subfeatures = blockSizes.map((size, i) => ({
    uniqueId: `${uniqueId}-block-${i}`,
    refName,
    start: tStarts[i]!,
    end: tStarts[i]! + size,
    strand,
    type: 'match_part',
  }))

  return {
    uniqueId,
    refName,
    start,
    end,
    strand,
    type: 'match',
    name: `${qName} ${identity.toFixed(1)}%`,
    score,
    identity: Number(identity.toFixed(1)),
    matches,
    misMatches,
    subfeatures,
  }
}

export function pslToFeatures(
  data: BlatJsonResponse,
): SimpleFeatureSerialized[] {
  const col = Object.fromEntries(data.fields.map((f, i) => [f, i]))
  return data.blat.map((row, i) => pslRowToFeature(row, col, i))
}

export const MINIMUM_BLAT_LENGTH = 20

// UCSC rejects queries over 25kb server-side; enforce locally for a clear message
export const MAXIMUM_BLAT_LENGTH = 25000

export function buildBlatBody({
  db,
  seq,
  apiKey,
}: {
  db: string
  seq: string
  apiKey?: string
}) {
  const params = new URLSearchParams({
    userSeq: seq,
    type: 'DNA',
    db,
    output: 'json',
  })
  // UCSC removed open programmatic BLAT access in 2025; an account apiKey
  // (Genome Browser account → Hub Development → API key) bypasses the
  // Cloudflare Turnstile that otherwise fronts hgBlat
  if (apiKey) {
    params.set('apiKey', apiKey)
  }
  return params.toString()
}

// thrown when the server returns its CAPTCHA challenge page instead of results
// — the caller surfaces a "solve challenge" affordance for this case (and, when
// available, an apiKey avoids the challenge entirely)
export class BlatChallengeError extends Error {
  name = 'BlatChallengeError'
}

// hgBlat returns text/html content-type with a JSON body, and both non-match
// errors and the Cloudflare Turnstile challenge come back as HTML pages, so we
// parse the text ourselves and give a readable error if it isn't JSON
export function parseBlatResponse(text: string): SimpleFeatureSerialized[] {
  if (text.trimStart().startsWith('<')) {
    if (/turnstile|challenge|captcha|cf-/i.test(text)) {
      throw new BlatChallengeError(
        'The BLAT server returned a CAPTCHA challenge instead of results. ' +
          'Solve it in the window, or supply a UCSC apiKey (Genome Browser ' +
          'account → Hub Development → API key) to avoid it.',
      )
    }
    throw new Error(
      'BLAT server returned an unexpected HTML response instead of JSON',
    )
  }
  const data = JSON.parse(text) as BlatJsonResponse
  return pslToFeatures(data)
}

export const DEFAULT_BLAT_URL = 'https://genome.ucsc.edu/cgi-bin/hgBlat'

export async function runBlat({
  db,
  seq,
  urlBase = DEFAULT_BLAT_URL,
  apiKey,
}: {
  db: string
  seq: string
  urlBase?: string
  apiKey?: string
}) {
  // a browser fetch straight to genome.ucsc.edu is CORS-blocked and surfaces as
  // an opaque TypeError; rethrow with the proxy requirement spelled out
  const response = await fetch(urlBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildBlatBody({ db, seq, apiKey }),
  }).catch((e: unknown) => {
    throw new Error(
      `Could not reach the BLAT server at ${urlBase}. In the browser this must ` +
        `be a CORS-enabled proxy, not genome.ucsc.edu directly (${e}).`,
    )
  })
  if (!response.ok) {
    throw new Error(
      `hgBlat request failed (${response.status}): ${await response.text()}`,
    )
  }
  return parseBlatResponse(await response.text())
}
