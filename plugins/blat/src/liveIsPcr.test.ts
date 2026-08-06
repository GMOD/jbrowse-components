/**
 * Live UCSC round-trip: a real hgPcr response, parsed into amplicon features.
 *
 * Skipped unless UCSC_API_KEY is set, since it needs an account key (keyless
 * hgPcr is behind a Cloudflare Turnstile) and the network. ispcrQuery.test.ts
 * covers the parsing offline against a fixture; what only a live run can show is
 * that the `<PRE>`-wrapped FASTA header this code scans for is the shape the
 * server actually sends, and that an amplicon comes back spanning exactly the
 * window its primers were taken from.
 *
 * Primers are derived from the reference rather than hardcoded, so every
 * coordinate asserted here is computed from the window that produced them: a
 * product at the wrong offset, or off by the interbase conversion, fails rather
 * than matching a number someone typed to make the test pass.
 *
 * Unlike hgBlat there is no multi-record batching — one request is one primer
 * pair — so the two scenarios cost two rate-limited hits and the test waits
 * between them.
 */
import { revcom } from '@jbrowse/core/util'

import {
  UCSC_ISPCR_URL,
  buildIsPcrBody,
  parseIsPcrProducts,
  parseIsPcrResponse,
} from './ispcrQuery.ts'
import { ispcrToSam } from './ispcrToSam.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

const apiKey = process.env.UCSC_API_KEY

// hg38 TP53, the locus the desktop BLAT figure uses in hg19. Its edges make a
// specific 22bp pair; picking a window whose edges happen to be low-complexity
// amplifies somewhere else entirely (ACTB intron 1 starts `TTTTAAGGTGTGCACTTTTATT`
// and lands a 724bp product on chr11), which is a property of the primers, not a
// bug — so the window is chosen, not arbitrary.
const DB = 'hg38'
const CHROM = 'chr17'
const START = 7676520
const END = 7676667
const PRIMER_LENGTH = 22

// UCSC allows one hgPcr hit per 15s per key, and this file sends two
const RATE_LIMIT_MS = 16000

async function runIsPcrRaw(forwardPrimer: string, reversePrimer: string) {
  // UCSC itself, not DEFAULT_ISPCR_URL: the default is the shared proxy, which
  // overwrites the client's apiKey with its own — liveProxy.test.ts is what
  // covers that path
  const res = await fetch(UCSC_ISPCR_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildIsPcrBody({ db: DB, forwardPrimer, reversePrimer, apiKey }),
  })
  return res.text()
}

// The pair a product converts to, as the records a SamAdapter would read.
function samPair(text: string) {
  return ispcrToSam(parseIsPcrProducts(text))
    .split('\n')
    .filter(line => line && !line.startsWith('@'))
    .map(line => {
      const f = line.split('\t')
      return {
        flag: Number(f[1]),
        pos: Number(f[3]),
        tlen: Number(f[8]),
        seq: f[9]!,
      }
    })
}

/**
 * Both footprints of a perfectly-matching pair have to read back as the
 * reference's own bases, whichever strand the product is on: SEQ is
 * reference-forward, so the low footprint is its primer as submitted and the high
 * one is the reverse complement of it, and both land on the template. Getting
 * that backwards is not a subtle bug in the figure, it draws a mismatch at every
 * base under a product UCSC called a perfect match, so it is worth checking
 * against a real response rather than only against our own fixture.
 */
function expectPairMatchesReference(text: string, ref: string) {
  const [low, high] = samPair(text)
  expect(low!.pos).toBe(START + 1)
  expect(high!.pos).toBe(END - PRIMER_LENGTH + 1)
  expect(low!.seq).toBe(ref.slice(0, PRIMER_LENGTH))
  expect(high!.seq).toBe(ref.slice(-PRIMER_LENGTH))
  // the mates face each other and the insert is the product
  expect(low!.flag & 16).toBe(0)
  expect(high!.flag & 16).toBe(16)
  expect(low!.tlen).toBe(END - START)
  expect(high!.tlen).toBe(-(END - START))
}

const describeProduct = (f: SimpleFeatureSerialized) =>
  `${f.refName}:${f.start}-${f.end} strand ${f.strand} "${f.name}"`

// the product spanning the window the primers came from, named so a run that
// amplifies something unexpected says what it got instead of failing on [0]
function productAtLocus(products: SimpleFeatureSerialized[]) {
  // eslint-disable-next-line no-console
  console.log(products.map(describeProduct).join('\n'))
  const found = products.find(
    f => f.refName === CHROM && f.start === START && f.end === END,
  )
  expect(found).toBeDefined()
  return found!
}

const maybe = apiKey ? describe : describe.skip

maybe('live UCSC in-silico PCR round-trip', () => {
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

  it('amplifies the window its primers were taken from', async () => {
    const forwardPrimer = ref.slice(0, PRIMER_LENGTH)
    const reversePrimer = revcom(ref.slice(-PRIMER_LENGTH))
    const text = await runIsPcrRaw(forwardPrimer, reversePrimer)
    const product = productAtLocus(parseIsPcrResponse(text))

    expect(product.strand).toBe(1)
    // hgPcr states the size in the header; it has to agree with the span the
    // same header's coordinates describe
    expect(product.name).toBe(`${END - START} bp`)
    expect(product.type).toBe('PCR_product')
    expect(product.forwardPrimer).toBe(forwardPrimer)
    expect(product.reversePrimer).toBe(reversePrimer)

    // on a plus-strand product the forward primer sits at the low coordinate
    const [low, high] = product.subfeatures!
    expect(low).toMatchObject({
      name: 'forward primer',
      start: START,
      end: START + PRIMER_LENGTH,
      type: 'primer',
    })
    expect(high).toMatchObject({
      name: 'reverse primer',
      start: END - PRIMER_LENGTH,
      end: END,
    })
    expectPairMatchesReference(text, ref)
  }, 120000)

  // The minus-strand footprint labelling is the subtlest thing the parser does
  // and offline it is only checked against a hand-written header. Swapping the
  // pair asks the real server for the same amplicon on the other strand: the
  // primer at the low coordinate is now the reverse one.
  it('labels the footprints by position, not by role, on a minus product', async () => {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_MS))

    // Exchange the working pair rather than re-complementing its ends: primers
    // have to point at each other to amplify anything, and revcom-ing the left
    // end instead turns them back to back (verified: zero products). Handing the
    // working reverse primer in as the forward one puts the forward primer on the
    // minus strand, which is what makes hgPcr report the product there.
    const forwardPrimer = revcom(ref.slice(-PRIMER_LENGTH))
    const reversePrimer = ref.slice(0, PRIMER_LENGTH)
    const text = await runIsPcrRaw(forwardPrimer, reversePrimer)
    const product = productAtLocus(parseIsPcrResponse(text))

    expect(product.strand).toBe(-1)
    const [low, high] = product.subfeatures!
    expect(low).toMatchObject({
      name: 'reverse primer',
      start: START,
      end: START + PRIMER_LENGTH,
    })
    expect(high).toMatchObject({
      name: 'forward primer',
      start: END - PRIMER_LENGTH,
      end: END,
    })
    // identical to the plus case on purpose: SEQ is reference-forward, so which
    // primer was called forward changes the labels but not a single base
    expectPairMatchesReference(text, ref)
  }, 120000)
})
