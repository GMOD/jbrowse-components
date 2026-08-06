import { challengeError, isChallengePage } from './blatQuery.ts'

import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

// UCSC hgPcr (In-Silico PCR). Unlike hgBlat there is no output=json mode; a
// successful query returns an HTML page whose <PRE> block holds FASTA amplicons
// with headers like:
//   >chr9:132576352+132576623 272bp GTGACGTCG... CCTAGGTTG...
// where the sign between the two 1-based coordinates is the product strand and
// the two trailing tokens are the forward and reverse primers as submitted.
//
// Not anchored to the start of a line. The whole shape — a '>', a locus with a
// strand sign inside it, a bp count, two primers — is specific enough on its
// own, and the anchor was a standing bet that markup never precedes the '>' on
// its line. `<PRE>` opening on the same line as the first amplicon is all it
// would take to lose that product, and this parser has already shipped one
// silent zero-products bug of exactly that kind (see the anchored-header test).
// A '>' still may not reach across a newline to claim a header below it.
const AMPLICON_HEADER =
  />[^\S\n]*(\S+):(\d+)([+-])(\d+)\s+(\d+)bp\s+(\S+)\s+(\S+)/g

export const UCSC_ISPCR_URL = 'https://genome.ucsc.edu/cgi-bin/hgPcr'

// The jbrowse.org proxy, for the same reasons as DEFAULT_BLAT_URL: it holds the
// apiKey, so a first query costs neither a key nor a CAPTCHA, and desktop keeps
// UCSC_ISPCR_URL in reserve for when the proxy cannot serve.
export const DEFAULT_ISPCR_URL = 'https://api.jbrowse.org/ucsc/v1/ispcr'

// hgPcr's default cap; also the server-side max the CGI accepts without error
export const DEFAULT_MAX_PRODUCT_SIZE = 4000

// primers shorter than this are rejected by hgPcr as too unspecific
export const MINIMUM_PRIMER_LENGTH = 15

/** One amplicon, in the terms the header states it. */
export interface PcrProduct {
  refName: string
  /** interbase, half-open */
  start: number
  end: number
  /** the strand hgPcr reports the product on, i.e. which primer was forward */
  strand: 1 | -1
  size: number
  /** the primers as submitted, 5'->3' */
  forwardPrimer: string
  reversePrimer: string
}

/**
 * The two primer footprints, low coordinate first.
 *
 * A primer pair converges: the footprint at the low coordinate reads rightward
 * and the one at the high coordinate reads leftward, whichever of the two the
 * submitter called forward. Only *which* is which follows the product strand —
 * on a plus product the forward primer sits at the low end, on a minus product
 * it sits at the high end.
 *
 * Each footprint carries the primer's own bases, which is what lets a mismatch
 * against the template be drawn rather than a perfect anneal assumed. They are
 * as submitted, i.e. 5'->3' on the strand that primer anneals to, so a footprint
 * at the low end reads on the reference's plus strand and one at the high end
 * has to be reverse-complemented to sit on it ({@link ispcrToSam} does that).
 */
export function productFootprints(product: PcrProduct) {
  const { start, end, strand, forwardPrimer, reversePrimer } = product
  const lowIsForward = strand === 1
  const lowPrimer = lowIsForward ? forwardPrimer : reversePrimer
  const highPrimer = lowIsForward ? reversePrimer : forwardPrimer
  return {
    low: {
      name: lowIsForward ? 'forward primer' : 'reverse primer',
      role: lowIsForward ? ('fwd' as const) : ('rev' as const),
      start,
      end: start + lowPrimer.length,
      primer: lowPrimer,
    },
    high: {
      name: lowIsForward ? 'reverse primer' : 'forward primer',
      role: lowIsForward ? ('rev' as const) : ('fwd' as const),
      start: end - highPrimer.length,
      end,
      primer: highPrimer,
    },
  }
}

export function parseIsPcrProducts(text: string): PcrProduct[] {
  // a successful result is HTML (FASTA inside <PRE>), and so are the "no
  // results" and Cloudflare Turnstile pages, so we can't reject on the leading
  // '<' the way BLAT's JSON path does. Scan for amplicon headers first; only if
  // none are found do we distinguish a challenge from a genuine empty result,
  // which avoids mistaking incidental "cf-"/"challenge" markup on a real result
  // page for a CAPTCHA
  //
  // hgPcr links each amplicon's position to the browser, so a real header is
  //   &gt;<A HREF="../cgi-bin/hgTracks?...">chr17:7676521+7676667</A> 147bp ...
  // and the position never followed the '>' directly. Strip markup before
  // decoding entities, in that order: tags first, so escaped text can't be read
  // as a tag, then '&gt;' becomes the '>' the header starts with.
  const decoded = text
    .replaceAll(/<[^>]*>/g, '')
    .replaceAll('&gt;', '>')
    .replaceAll('&lt;', '<')
  const products: PcrProduct[] = []
  for (const match of decoded.matchAll(AMPLICON_HEADER)) {
    const [, refName, startStr, sign, endStr, sizeStr, fwd, rev] = match
    products.push({
      refName: refName!,
      // headers are 1-based inclusive; convert to interbase half-open
      start: Number(startStr) - 1,
      end: Number(endStr),
      strand: sign === '-' ? -1 : 1,
      size: Number(sizeStr),
      forwardPrimer: fwd!,
      reversePrimer: rev!,
    })
  }
  // the raw text, not `decoded`: a challenge page IS markup, so stripping tags
  // would throw away the very thing that identifies it
  if (!products.length && isChallengePage(text)) {
    throw challengeError()
  }
  return products
}

export function pcrProductsToFeatures(
  products: PcrProduct[],
): SimpleFeatureSerialized[] {
  return products.map(product => {
    const { refName, start, end, strand, size } = product
    const uniqueId = `ispcr-${refName}-${start}-${end}-${strand}`
    const { low, high } = productFootprints(product)
    return {
      uniqueId,
      refName,
      start,
      end,
      strand,
      type: 'PCR_product',
      name: `${size} bp`,
      forwardPrimer: product.forwardPrimer,
      reversePrimer: product.reversePrimer,
      // the footprints converge, so their strands are +1 and -1 whatever the
      // product's is: a primer's direction is its own, not the amplicon's
      subfeatures: [
        {
          uniqueId: `${uniqueId}-${low.role}`,
          name: low.name,
          refName,
          start: low.start,
          end: low.end,
          strand: 1,
          type: 'primer',
        },
        {
          uniqueId: `${uniqueId}-${high.role}`,
          name: high.name,
          refName,
          start: high.start,
          end: high.end,
          strand: -1,
          type: 'primer',
        },
      ],
    }
  })
}

export function parseIsPcrResponse(text: string): SimpleFeatureSerialized[] {
  return pcrProductsToFeatures(parseIsPcrProducts(text))
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
