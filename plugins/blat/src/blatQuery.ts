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
function parseCommaList(value: string) {
  return value.split(',').filter(Boolean).map(Number)
}

// kent's pslCalcMilliBad with isMrna=true, which is what hgBlat's own hit table
// reports: a target span longer than the query is an intron rather than a
// penalty, and target inserts aren't charged. Integer-divided like the C
// original so the percentage matches the number UCSC prints.
function pslMilliBad({
  matches,
  misMatches,
  repMatches,
  qNumInsert,
  qAliSize,
  tAliSize,
}: {
  matches: number
  misMatches: number
  repMatches: number
  qNumInsert: number
  qAliSize: number
  tAliSize: number
}) {
  const total = matches + repMatches + misMatches
  const sizeDif = Math.max(0, qAliSize - tAliSize)
  return Math.min(qAliSize, tAliSize) <= 0 || total === 0
    ? 0
    : Math.trunc(
        (1000 *
          (misMatches + qNumInsert + Math.round(3 * Math.log(1 + sizeDif)))) /
          total,
      )
}

/**
 * One PSL hit, with the column-name indirection resolved and the derived
 * kent numbers (score, identity, coverage) computed once. Both consumers read
 * this: the hit-list features, and the SAM conversion that turns the blocks into
 * a CIGAR alignment.
 */
export interface PslRow {
  matches: number
  misMatches: number
  repMatches: number
  qNumInsert: number
  qBaseInsert: number
  tNumInsert: number
  tBaseInsert: number
  strand: 1 | -1
  qName: string
  qSize: number
  qStart: number
  qEnd: number
  tName: string
  tSize: number
  tStart: number
  tEnd: number
  blockSizes: number[]
  qStarts: number[]
  tStarts: number[]
  score: number
  identity: number
  coverage: number
}

function pslRow(row: (string | number)[], col: Record<string, number>): PslRow {
  const str = (name: string) => String(row[col[name]!] ?? '')
  const num = (name: string) => Number(row[col[name]!] ?? 0)
  const matches = num('matches')
  const misMatches = num('misMatches')
  const repMatches = num('repMatches')
  const qNumInsert = num('qNumInsert')
  const tNumInsert = num('tNumInsert')
  const qStart = num('qStart')
  const qEnd = num('qEnd')
  const qSize = num('qSize')
  const tStart = num('tStart')
  const tEnd = num('tEnd')

  return {
    matches,
    misMatches,
    repMatches,
    qNumInsert,
    qBaseInsert: num('qBaseInsert'),
    tNumInsert,
    tBaseInsert: num('tBaseInsert'),
    strand: str('strand').startsWith('-') ? -1 : 1,
    qName: str('qName'),
    qSize,
    qStart,
    qEnd,
    tName: str('tName'),
    tSize: num('tSize'),
    tStart,
    tEnd,
    blockSizes: parseCommaList(str('blockSizes')),
    qStarts: parseCommaList(str('qStarts')),
    tStarts: parseCommaList(str('tStarts')),
    // kent's pslScore, which ranks the hit table: repeat matches count half
    score: matches + (repMatches >> 1) - misMatches - qNumInsert - tNumInsert,
    identity:
      100 -
      pslMilliBad({
        matches,
        misMatches,
        repMatches,
        qNumInsert,
        qAliSize: qEnd - qStart,
        tAliSize: tEnd - tStart,
      }) /
        10,
    // how much of the submitted sequence this hit accounts for — the other half
    // of "did my sequence map here", since a high-identity hit over 10% of the
    // query is not the locus you were looking for
    coverage: qSize > 0 ? (100 * (qEnd - qStart)) / qSize : 0,
  }
}

// Sorted by score descending, matching the order hgBlat lists its hit table in,
// so consumers can treat the first row as the best placement of the query.
export function parsePslRows(data: BlatJsonResponse): PslRow[] {
  // JSON that is not a PSL table at all — a proxy or mirror relaying its own
  // envelope, a kent JSON error — otherwise reached `.map` on undefined and
  // surfaced a TypeError where the server's own words belong
  if (!Array.isArray(data.fields) || !Array.isArray(data.blat)) {
    throw new Error(
      'BLAT server returned JSON without the expected fields/blat columns',
    )
  }
  const col = Object.fromEntries(data.fields.map((f, i) => [f, i]))
  return data.blat
    .map(row => pslRow(row, col))
    .sort((a, b) => b.score - a.score)
}

function pslRowToFeature(
  row: PslRow,
  featureIndex: number,
): SimpleFeatureSerialized {
  const { tName: refName, strand, identity, blockSizes, tStarts } = row
  const uniqueId = `blat-${featureIndex}`
  return {
    uniqueId,
    refName,
    start: row.tStart,
    end: row.tEnd,
    strand,
    type: 'match',
    name: `${row.qName} ${identity.toFixed(1)}%`,
    score: row.score,
    identity: Number(identity.toFixed(1)),
    coverage: Number(row.coverage.toFixed(1)),
    matches: row.matches,
    misMatches: row.misMatches,
    queryName: row.qName,
    queryStart: row.qStart,
    queryEnd: row.qEnd,
    querySize: row.qSize,
    blockCount: blockSizes.length,
    subfeatures: blockSizes.map((size, i) => ({
      uniqueId: `${uniqueId}-block-${i}`,
      refName,
      start: tStarts[i]!,
      end: tStarts[i]! + size,
      strand,
      type: 'match_part',
    })),
  }
}

export function pslToFeatures(rows: PslRow[]): SimpleFeatureSerialized[] {
  return rows.map((row, i) => pslRowToFeature(row, i))
}

export const MINIMUM_BLAT_LENGTH = 20

// UCSC rejects queries over 25kb server-side; enforce locally for a clear message
export const MAXIMUM_BLAT_LENGTH = 25000

// hgBlat's per-submission cap on FASTA records
export const MAXIMUM_BLAT_QUERIES = 25

// residues only, for the length limits. The query itself goes to the server
// verbatim: hgBlat parses FASTA and labels each hit with its record's name, so
// stripping headers here would fuse a multi-record paste into one chimeric
// query and throw away the names that tell the hits apart.
//
// Letters only, which is what kent's FASTA reader counts and therefore what the
// limits are stated in — a sequence pasted with line numbers or alignment-gap
// dashes is fewer bases to BLAT than it has characters. Counting whitespace out
// but digits in measured a 25kb-limited query against a number the server does
// not use. Same rule as parseQuerySequences, which has to agree with `qSize`.
export function stripFasta(seq: string) {
  return seq
    .split('\n')
    .filter(line => !line.startsWith('>'))
    .join('')
    .replaceAll(/[^A-Za-z]/g, '')
}

// hgBlat places each FASTA record separately, so records are queries
export function fastaRecordCount(seq: string) {
  const headers = seq.match(/^>/gm)
  return headers ? headers.length : 1
}

// names the result track after what was searched: the first FASTA header, or
// the leading bases of a bare sequence
export function queryLabel(seq: string) {
  const header = /^>\s*(\S+)/m.exec(seq)
  const residues = stripFasta(seq)
  return header
    ? header[1]!
    : residues.slice(0, 12) + (residues.length > 12 ? '…' : '')
}

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

// Markers on a Cloudflare Turnstile challenge page. Every marker has to be
// specific to the challenge itself: a bare `cf-`, `captcha` or `challenge` also
// matches an ordinary UCSC page, whose standard nav links to
// FAQdownloads.html#CAPTCHA and whose scripts load from challenges.cloudflare.com.
// Those two words made a failed parse of a perfectly good result page report
// itself as a CAPTCHA, sending the user off to solve one that wasn't there.
//
// Duplicated in `products/aws/blat-proxy/src/routes.ts`, which decides the same thing
// about the same pages server-side. The proxy is a standalone package and cannot
// import this one, so the copies are deliberate: narrow one and narrow both.
const CHALLENGE_MARKERS = /turnstile|cf[-_]chl/i

export function isChallengePage(text: string) {
  return CHALLENGE_MARKERS.test(text)
}

export function challengeError() {
  return new BlatChallengeError(
    'The UCSC server returned a CAPTCHA challenge instead of results. ' +
      'Solve it in the window, or supply a UCSC apiKey (Genome Browser ' +
      'account → Hub Development → API key) to avoid it.',
  )
}

// kent CGIs report a bad db ("Can't find database …") or a server-side failure
// by errAbort-ing into an HTML page, usually inside a <pre>. Pull that text out
// so an assembly UCSC doesn't host says why, rather than "unexpected HTML".
function htmlErrorMessage(text: string) {
  const pre = /<pre[^>]*>([\S\s]*?)<\/pre>/i.exec(text)
  return (pre ? pre[1]! : text)
    .replaceAll(/<(script|style)[\S\s]*?<\/\1>/gi, ' ')
    .replaceAll(/<[^>]*>/g, ' ')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

// hgBlat returns text/html content-type with a JSON body, and both non-match
// errors and the Cloudflare Turnstile challenge come back as HTML pages, so we
// parse the text ourselves and give a readable error if it isn't JSON
export function parseBlatResponse(text: string): PslRow[] {
  if (text.trimStart().startsWith('<')) {
    if (isChallengePage(text)) {
      throw challengeError()
    }
    const message = htmlErrorMessage(text)
    throw new Error(
      message
        ? `BLAT server error: ${message}`
        : 'BLAT server returned an unexpected HTML response instead of JSON',
    )
  }
  const data = JSON.parse(text) as BlatJsonResponse
  return parsePslRows(data)
}

export const UCSC_BLAT_URL = 'https://genome.ucsc.edu/cgi-bin/hgBlat'

/**
 * Where the dialog points when the user has not typed a server of their own:
 * the jbrowse.org proxy, which injects a UCSC apiKey server-side and meters the
 * budget everyone using it shares (`products/aws/blat-proxy`). That is what makes
 * a first BLAT work with no key and no CAPTCHA.
 *
 * A browser has nowhere else to go — it cannot call genome.ucsc.edu at all (no
 * CORS headers) and must not carry a key in a public bundle. Desktop can reach
 * UCSC itself, since `blatFetch` runs in the main process, so it keeps
 * {@link UCSC_BLAT_URL} in reserve two ways: as the fallback when the proxy is
 * out of budget or down, and as where the server field moves outright once the
 * user supplies an apiKey of their own. The proxy overwrites a client key with
 * its own, so a key only ever spends against UCSC direct.
 *
 * Either way this is only a default — the dialog's server field overrides it,
 * which is how someone runs their own proxy or their own gfServer.
 */
export const DEFAULT_BLAT_URL = 'https://api.jbrowse.org/ucsc/v1/blat'

// the proxy's status route sits beside its query routes (`.../v1/status`)
export function proxyStatusUrl(queryUrl: string) {
  return new URL('status', queryUrl).href
}

export type ProxyStatus = { ok: true } | { ok: false; message: string }

/**
 * The proxy's `/status` answer, read before a query goes out. `ok: false`
 * carries an operator's sentence about an outage — the kill switch for a
 * UCSC-side change this client cannot absorb. Anything that is not that shape
 * reads as ok: a status the client cannot understand is not evidence of an
 * outage, and the query itself will say what is wrong.
 */
export function parseProxyStatus(data: unknown): ProxyStatus {
  let status: ProxyStatus = { ok: true }
  if (data !== null && typeof data === 'object' && 'ok' in data) {
    const message = 'message' in data ? data.message : undefined
    if (data.ok === false && typeof message === 'string' && message) {
      status = { ok: false, message }
    }
  }
  return status
}
