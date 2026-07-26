/**
 * Live round-trip through the deployed `aws/blat-proxy` Lambda, for both routes.
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

import { buildBlatBody, parseBlatResponse } from './blatQuery.ts'
import { buildIsPcrBody, parseIsPcrResponse } from './ispcrQuery.ts'
import { parseQuerySequences, pslToSam } from './pslToSam.ts'

const base = process.env.JBROWSE_UCSC_PROXY_URL?.replace(/\/$/, '')

// hg38 TP53, the locus liveIsPcr uses: its edges make a specific 22bp primer pair
const DB = 'hg38'
const CHROM = 'chr17'
const START = 7676520
const END = 7676667
const PRIMER_LENGTH = 22

async function post(route: string, body: string, contentType: string) {
  const res = await fetch(`${base}/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
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
