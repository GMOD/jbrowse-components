import { BlatChallengeError } from './blatQuery.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// UCSC hgPcr (In-Silico PCR). Unlike hgBlat there is no output=json mode; a
// successful query returns an HTML page whose <PRE> block holds FASTA amplicons
// with headers like:
//   >chr9:132576352+132576623 272bp GTGACGTCG... CCTAGGTTG...
// where the sign between the two 1-based coordinates is the product strand and
// the two trailing tokens are the forward and reverse primers as submitted.
const AMPLICON_HEADER =
  /^>\s*(\S+):(\d+)([+-])(\d+)\s+(\d+)bp\s+(\S+)\s+(\S+)/gm

export const DEFAULT_ISPCR_URL = 'https://genome.ucsc.edu/cgi-bin/hgPcr'

// hgPcr's default cap; also the server-side max the CGI accepts without error
export const DEFAULT_MAX_PRODUCT_SIZE = 4000

// primers shorter than this are rejected by hgPcr as too unspecific
export const MINIMUM_PRIMER_LENGTH = 15

export function parseIsPcrResponse(text: string): SimpleFeatureSerialized[] {
  // a successful result is HTML (FASTA inside <PRE>), and so are the "no
  // results" and Cloudflare Turnstile pages, so we can't reject on the leading
  // '<' the way BLAT's JSON path does. Scan for amplicon headers first; only if
  // none are found do we distinguish a challenge from a genuine empty result,
  // which avoids mistaking incidental "cf-"/"challenge" markup on a real result
  // page for a CAPTCHA
  const decoded = text.replaceAll('&gt;', '>').replaceAll('&lt;', '<')
  const features: SimpleFeatureSerialized[] = []
  for (const match of decoded.matchAll(AMPLICON_HEADER)) {
    const [, refName, startStr, sign, endStr, sizeStr, fwd, rev] = match
    const strand = sign === '-' ? -1 : 1
    // headers are 1-based inclusive; convert to interbase half-open
    const start = Number(startStr) - 1
    const end = Number(endStr)
    const size = Number(sizeStr)

    // the primer at the low-coordinate end is the forward primer on a plus
    // product and the reverse primer on a minus product
    const startPrimer = strand === 1 ? fwd! : rev!
    const endPrimer = strand === 1 ? rev! : fwd!
    const uniqueId = `ispcr-${refName}-${start}-${end}`

    features.push({
      uniqueId,
      refName: refName!,
      start,
      end,
      strand,
      type: 'PCR_product',
      name: `${size} bp`,
      forwardPrimer: fwd,
      reversePrimer: rev,
      subfeatures: [
        {
          uniqueId: `${uniqueId}-fwd`,
          refName: refName!,
          start,
          end: start + startPrimer.length,
          strand,
          type: 'primer',
        },
        {
          uniqueId: `${uniqueId}-rev`,
          refName: refName!,
          start: end - endPrimer.length,
          end,
          strand,
          type: 'primer',
        },
      ],
    })
  }
  if (!features.length && /turnstile|cf[-_]chl|captcha/i.test(decoded)) {
    throw new BlatChallengeError(
      'The UCSC server returned a CAPTCHA challenge instead of results. ' +
        'Solve it in the window, or supply a UCSC apiKey (Genome Browser ' +
        'account → Hub Development → API key) to avoid it.',
    )
  }
  return features
}

export function buildIsPcrBody({
  db,
  forwardPrimer,
  reversePrimer,
  maxProductSize = DEFAULT_MAX_PRODUCT_SIZE,
  apiKey,
}: {
  db: string
  forwardPrimer: string
  reversePrimer: string
  maxProductSize?: number
  apiKey?: string
}) {
  const params = new URLSearchParams({
    db,
    wp_target: 'genome',
    wp_f: forwardPrimer,
    wp_r: reversePrimer,
    wp_size: String(maxProductSize),
    wp_perfect: '15',
    wp_good: '15',
    'boolshad.wp_flipReverse': '0',
  })
  // as with hgBlat, an account apiKey bypasses the Cloudflare Turnstile
  if (apiKey) {
    params.set('apiKey', apiKey)
  }
  return params.toString()
}

export async function runIsPcr({
  db,
  forwardPrimer,
  reversePrimer,
  urlBase = DEFAULT_ISPCR_URL,
  maxProductSize,
  apiKey,
}: {
  db: string
  forwardPrimer: string
  reversePrimer: string
  urlBase?: string
  maxProductSize?: number
  apiKey?: string
}) {
  const response = await fetch(urlBase, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildIsPcrBody({
      db,
      forwardPrimer,
      reversePrimer,
      maxProductSize,
      apiKey,
    }),
  }).catch((e: unknown) => {
    throw new Error(
      `Could not reach the in-silico PCR server at ${urlBase}. In the browser ` +
        `this must be a CORS-enabled proxy, not genome.ucsc.edu directly (${e}).`,
    )
  })
  if (!response.ok) {
    throw new Error(
      `hgPcr request failed (${response.status}): ${await response.text()}`,
    )
  }
  return parseIsPcrResponse(await response.text())
}
