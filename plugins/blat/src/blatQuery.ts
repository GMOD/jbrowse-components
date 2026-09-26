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
  return rows.map(pslRowToFeature)
}

export const MINIMUM_BLAT_LENGTH = 20

// hgBlat's own three caps, which its submission page states: 25,000 bases in one
// DNA sequence, 50,000 across a multi-record submission, 25 records. The
// per-sequence and combined numbers are separate limits — holding the total to
// 25,000 refused a three-record FASTA the server would have taken.
export const MAXIMUM_BLAT_SEQUENCE_LENGTH = 25000
export const MAXIMUM_BLAT_TOTAL_LENGTH = 50000
export const MAXIMUM_BLAT_QUERIES = 25

/**
 * One submitted FASTA record. `name` is the header's first token and is absent
 * for a bare sequence, which hgBlat labels `YourSeq`.
 *
 * `residues` keeps letters only, which is what kent's FASTA reader counts and
 * therefore what both the limits and `qSize` are stated in: a sequence pasted
 * with line numbers or alignment-gap dashes is fewer bases to BLAT than it has
 * characters.
 */
export interface FastaRecord {
  name?: string
  residues: string
}

/**
 * The submitted text split the way hgBlat splits it: each record is placed
 * separately and its hits are labelled with its name. The length limits, the
 * track label and the name-to-bases map the SAM conversion needs all come off
 * this one reader, so none of them can disagree about where a record starts.
 *
 * The text itself still goes to the server verbatim — stripping the headers here
 * would fuse a multi-record paste into one chimeric query and throw away the
 * names that tell the hits apart.
 */
export function parseFastaRecords(text: string): FastaRecord[] {
  const records: FastaRecord[] = []
  let name: string | undefined
  let residues: string[] = []
  const flush = () => {
    const joined = residues.join('')
    if (joined) {
      records.push({ name, residues: joined })
    }
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('>')) {
      flush()
      name = /^>\s*(\S+)/.exec(line)?.[1]
      residues = []
    } else {
      residues.push(line.replaceAll(/[^A-Za-z]/g, ''))
    }
  }
  flush()
  return records
}

export function blatResidueCount(records: FastaRecord[]) {
  return records.reduce((sum, record) => sum + record.residues.length, 0)
}

// Why this query cannot be sent, in the terms hgBlat states its limits in, or
// '' when it can. Checked here rather than left to the server so an over-long
// paste says which cap it broke instead of coming back as a kent error page.
export function blatQueryProblem(records: FastaRecord[]) {
  const total = blatResidueCount(records)
  // reduced rather than spread into Math.max: the record cap is checked below
  // this, so the list reaching here is whatever was pasted
  const longest = records.reduce(
    (max, record) => Math.max(max, record.residues.length),
    0,
  )
  const subject = records.length > 1 ? 'Longest sequence' : 'Sequence'
  if (longest > MAXIMUM_BLAT_SEQUENCE_LENGTH) {
    return `${subject} is ${longest.toLocaleString()} bp; UCSC BLAT is limited to ${MAXIMUM_BLAT_SEQUENCE_LENGTH.toLocaleString()} bp per sequence`
  } else if (total > MAXIMUM_BLAT_TOTAL_LENGTH) {
    return `${total.toLocaleString()} bp in total; UCSC BLAT is limited to ${MAXIMUM_BLAT_TOTAL_LENGTH.toLocaleString()} bp per query`
  } else if (records.length > MAXIMUM_BLAT_QUERIES) {
    return `${records.length} sequences; UCSC BLAT is limited to ${MAXIMUM_BLAT_QUERIES} per query`
  } else if (total > 0 && total < MINIMUM_BLAT_LENGTH) {
    return `Sequence must be at least ${MINIMUM_BLAT_LENGTH} bp`
  } else {
    return ''
  }
}

// names the result track after what was searched: the first record's header, or
// the leading bases of a bare sequence
export function queryLabel(records: FastaRecord[]) {
  const first = records[0]
  if (!first) {
    return ''
  }
  const { name, residues } = first
  return name ?? residues.slice(0, 12) + (residues.length > 12 ? '…' : '')
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

// Markers on a Cloudflare Turnstile challenge page. Every marker has to name
// the widget being MOUNTED, never a page that merely mentions it: a bare `cf-`,
// `captcha` or `challenge` matches an ordinary UCSC page, whose nav links to
// FAQdownloads.html#CAPTCHA, and a bare `turnstile` matches one too, because
// UCSC's Content-Security-Policy whitelists
// `challenges.cloudflare.com/turnstile/v0/api.js` on every page it serves —
// including the honest "No matches" that hgPcr answers a primer pair with.
// Each of those words in turn sent a user off to solve a CAPTCHA that was not
// there. `turnstile.render(` is the call that puts one on screen, and the
// challenge page is the only page that makes it.
//
// Duplicated in `products/aws/blat-proxy/src/routes.ts`, which decides the same thing
// about the same pages server-side. The proxy is a standalone package and cannot
// import this one, so the copies are deliberate: narrow one and narrow both.
const CHALLENGE_MARKERS = /turnstile\s*\.\s*render|cf[-_](?:chl|turnstile)/i

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
