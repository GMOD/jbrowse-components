/**
 * Live round-trip through the deployed `products/aws/blat-proxy` Lambda, for both routes.
 *
 * Skipped unless JBROWSE_UCSC_PROXY_URL is set to the stage base (e.g.
 * `https://<id>.execute-api.<region>.amazonaws.com/prod`). No apiKey: injecting
 * one is the proxy's whole job, so a client reaching it sends the same body it
 * would send UCSC, minus the key. Running this spends the shared key's budget,
 * which is why it is opt-in rather than merely network-gated.
 *
 * The proxy's own tests exercise its handler offline, and liveBlat/liveIsPcr
 * exercise UCSC directly with a key. Neither covers the seam this does: that what
 * the deployed Lambda hands back still parses on the client. hgPcr's amplicon
 * header is passed through as UCSC's HTML, so a proxy that is up, authorized and
 * returning 200 can still yield zero features — which is exactly how in-silico
 * PCR was broken before the header fix.
 */
import { revcom } from '@jbrowse/core/util'

import {
  buildBlatBody,
  parseBlatResponse,
  parseProxyStatus,
} from './blatQuery.ts'
import { buildIsPcrBody, parseIsPcrResponse } from './ispcrQuery.ts'
import { parseQuerySequences, pslToSam } from './pslToSam.ts'

const base = process.env.JBROWSE_UCSC_PROXY_URL?.replace(/\/$/, '')

// hg38 TP53, the locus liveIsPcr uses: its edges make a specific 22bp primer pair
const DB = 'hg38'
const CHROM = 'chr17'
const START = 7676520
const END = 7676667
const PRIMER_LENGTH = 22

// no-cache: this runs daily against a proxy that caches for a day, and an
// answer served from the table would report a broken UCSC as fine
function send(route: string, body: string) {
  return fetch(`${base}/${route}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body,
  })
}

async function post(route: string, body: string, contentType: string) {
  const first = await send(route, body)
  // The proxy allows one upstream call every 15s across BOTH routes, since both
  // spend one shared UCSC key — so two scenarios back to back are legitimately
  // refused, and waiting is the contract rather than padding against flake. The
  // delay comes from the proxy's own Retry-After, so it tracks the deployed
  // spacing instead of a number copied here that could drift from it.
  const res =
    first.status === 429
      ? await new Promise<Response>(resolve => {
          const seconds = Number(first.headers.get('Retry-After'))
          setTimeout(
            () => {
              resolve(send(route, body))
            },
            (Number.isFinite(seconds) ? seconds : 15) * 1000 + 500,
          )
        })
      : first
  const text = await res.text()
  // a proxy failure answers JSON with a reason; surface it rather than letting a
  // parse of an error body fail as "no results"
  if (!res.ok) {
    throw new Error(`${route} returned ${res.status}: ${text.slice(0, 300)}`)
  }
  expect(res.headers.get('Content-Type')).toContain(contentType)
  return text
}

const maybe = base ? describe : describe.skip

maybe('live UCSC proxy round-trip', () => {
  let ref = ''

  beforeAll(async () => {
    fetchMock.dontMock()
    const res = await fetch(
      `https://api.genome.ucsc.edu/getData/sequence?genome=${DB};chrom=${CHROM};start=${START};end=${END}`,
    )
    const { dna } = (await res.json()) as { dna: string }
    ref = dna.toUpperCase()
    expect(ref).toHaveLength(END - START)
  }, 60000)

  it('reports itself usable', async () => {
    const res = await fetch(`${base}/status`)
    expect(res.status).toBe(200)
    const status = parseProxyStatus(await res.json())
    expect(status).toEqual({ ok: true })
  }, 30000)

  it('serves a BLAT hit that converts to a placeable SAM record', async () => {
    const text = await post(
      'blat',
      buildBlatBody({ db: DB, seq: ref }),
      'application/json',
    )
    const rows = parseBlatResponse(text)
    expect(rows.length).toBeGreaterThan(0)

    const sam = pslToSam(rows, parseQuerySequences(ref))
    const best = sam
      .split('\n')
      .find(line => line && !line.startsWith('@'))!
      .split('\t')
    expect(best[2]).toBe(CHROM)
    expect(Number(best[3])).toBe(START + 1)
    // the query came back whole, so the pileup can draw per-base mismatches
    expect(best[9]).toHaveLength(ref.length)
  }, 120000)

  it('serves an hgPcr page whose amplicon header still parses', async () => {
    const text = await post(
      'ispcr',
      buildIsPcrBody({
        db: DB,
        forwardPrimer: ref.slice(0, PRIMER_LENGTH),
        reversePrimer: revcom(ref.slice(-PRIMER_LENGTH)),
      }),
      'text/html',
    )
    const products = parseIsPcrResponse(text)
    // the assertion that a 200 alone does not make: the passed-through HTML has
    // to yield features
    expect(products.length).toBeGreaterThan(0)
    expect(products).toContainEqual(
      expect.objectContaining({
        refName: CHROM,
        start: START,
        end: END,
        name: `${END - START} bp`,
      }),
    )
  }, 120000)
})
