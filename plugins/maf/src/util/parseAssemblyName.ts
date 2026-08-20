export interface ParsedAssemblyName {
  assemblyName: string
  chr: string
}

/**
 * A PanSN source token (`sample#haplotype#contig`) split into the row it names
 * and the contig within it, or undefined when the token isn't PanSN.
 *
 * The haplotype stays part of the row, not the contig: two haplotypes of one
 * sample are two distinct sequences in the alignment, so collapsing them onto
 * `sample` makes them the same key in the per-block `alignments` record and the
 * second silently overwrites the first — a diploid assembly would lose half its
 * rows. `chr` becomes the contig, which is what color-by-source-chromosome and
 * the inversion consensus key on.
 *
 * Recognised rather than guessed: PanSN is a written spec (`#` is its declared
 * delimiter and the field order is fixed), and `#` appears in no UCSC db or
 * chromosome name. The dot rules below cannot serve it — a PanSN token usually
 * has no dot at all, so it used to fall through to "the whole token is the
 * assembly, and it has no chromosome", giving one row per contig with an empty
 * `chr`. This repo's own `build_ecoli_pangenome_graph.sh` writes `strain#1#chr`.
 *
 * A contig containing `#` keeps it: only the first two fields are the row.
 */
function splitPanSn(token: string): ParsedAssemblyName | undefined {
  const first = token.indexOf('#')
  if (first === -1) {
    return undefined
  }
  const second = token.indexOf('#', first + 1)
  // `sample#contig` (no haplotype field) is tolerated as the two-field form
  const cut = second === -1 ? first : second
  return { assemblyName: token.slice(0, cut), chr: token.slice(cut + 1) }
}

/**
 * Split a MAF `genome.sequence` source token when no sample set is configured
 * to resolve it against — the discovery path shared by all three adapters
 * (MAF-tabix, bigMaf, TAF) and by the `.tai` index reader.
 *
 * Handles multiple formats:
 * - `sample#haplotype#contig` (PanSN): assemblyName is `sample#haplotype`, chr
 *   is the contig — see `splitPanSn`
 * - Single string with no separators: assemblyName is the entire string, chr is
 *   empty
 * - `assembly.chr`: Single dot separates assembly name from chromosome
 * - `assembly.version.chr`: Two dots where middle part is numeric (version number)
 *   - assemblyName includes the version (e.g., "hg38.1" from "hg38.1.chr1")
 * - `assembly.chr.more`: Two dots where middle part is non-numeric
 *   - assemblyName is first part, chr includes rest (e.g., "mm10" and "chr1.random")
 *
 * The numeric-middle case is the whole reason this isn't a plain first-dot
 * split: a haplotype-suffixed genome (`Species1.1.chr3`) otherwise discovers as
 * `Species1` with chr `1.chr3`. bigMaf and TAF used a first-dot splitter until
 * they were unified here, so the same alignment produced different rows and a
 * different `row.chr` (which drives color-by-source-chromosome and the
 * inversion consensus) depending on which file format it was read from.
 * `matchSampleId` remains preferred whenever a sample set exists — it resolves
 * exactly instead of heuristically.
 */
export function parseAssemblyAndChr(
  assemblyAndChr: string,
): ParsedAssemblyName {
  const panSn = splitPanSn(assemblyAndChr)
  if (panSn) {
    return panSn
  }
  const firstDotIndex = assemblyAndChr.indexOf('.')
  if (firstDotIndex === -1) {
    return {
      assemblyName: assemblyAndChr,
      chr: '',
    }
  }

  const secondDotIndex = assemblyAndChr.indexOf('.', firstDotIndex + 1)
  if (secondDotIndex === -1) {
    return {
      assemblyName: assemblyAndChr.slice(0, firstDotIndex),
      chr: assemblyAndChr.slice(firstDotIndex + 1),
    }
  }

  const secondPart = assemblyAndChr.slice(firstDotIndex + 1, secondDotIndex)
  // A version segment is a plain run of digits; `/^\d+$/` avoids the unary-`+`
  // coercion accepting `0x1f`, `1e3`, `Infinity`, or whitespace-padded numbers.
  const isNumeric = /^\d+$/.test(secondPart)

  if (isNumeric) {
    return {
      assemblyName: assemblyAndChr.slice(0, secondDotIndex),
      chr: assemblyAndChr.slice(secondDotIndex + 1),
    }
  }

  return {
    assemblyName: assemblyAndChr.slice(0, firstDotIndex),
    chr: assemblyAndChr.slice(firstDotIndex + 1),
  }
}

// The characters a source token puts between its genome and its sequence: `.`
// in UCSC/HAL naming, `#` in PanSN. Both are separators in the same position, so
// the prefix walk below treats them alike rather than the walk existing twice.
const SOURCE_SEPARATORS = new Set(['.', '#'])

/**
 * Resolve a `genome.sequence` source token against a known sample set by its
 * longest separator-bounded prefix (or the whole token). The genome can itself
 * contain separators — a `.1`/`.2` haplotype (`Species1.1.chr3`), a PanSN
 * haplotype field (`HG002#1#chr1`) — so a fixed split position is ambiguous and
 * the known set removes the guess. `Species1.1` beats `Species1` when both are
 * present, and `HG002#1` beats `HG002`.
 *
 * Still exact: every candidate has to *be* an id the config listed, so widening
 * the separator set can only resolve tokens that previously resolved to nothing,
 * or resolve one to a longer id the user explicitly asked for. It never guesses
 * a genome. Without `#` a PanSN file matched no id at all — the token has no
 * dot to walk, so `samples: ['K12']` against `K12#1#chr` returned undefined for
 * every row and the track drew its configured species as empty labelled rows.
 *
 * Returns undefined when no sample matches, so callers skip that token.
 */
export function matchSampleId(
  token: string,
  sampleIds: Set<string>,
): ParsedAssemblyName | undefined {
  if (sampleIds.has(token)) {
    return { assemblyName: token, chr: '' }
  }
  // Right to left, so the longest (most specific) prefix wins.
  for (let i = token.length - 1; i > 0; i--) {
    if (SOURCE_SEPARATORS.has(token[i]!)) {
      const candidate = token.slice(0, i)
      if (sampleIds.has(candidate)) {
        return { assemblyName: candidate, chr: token.slice(i + 1) }
      }
    }
  }
  return undefined
}

/** How many of each side to name in the "nothing matched" diagnostic. */
const REPORT_SOURCES = 3
const REPORT_IDS = 5

function quoteList(values: Iterable<string>, limit: number, total: number) {
  const shown = [...values].slice(0, limit).map(v => JSON.stringify(v))
  return total > shown.length
    ? `${shown.join(', ')} (+${total - shown.length} more)`
    : shown.join(', ')
}

/**
 * Resolve a `genome.sequence` source token to its sample. Wraps the choice all
 * three adapters were spelling for themselves — `matchSampleId` against a known
 * set, `parseAssemblyAndChr` when there is none — so the two paths cannot drift
 * apart between formats.
 *
 * It also watches for the one way a correct-looking config renders nothing.
 * A row whose token matches no sample is dropped, which is **normal**: listing
 * five species of a thirty-way is how you ask for five rows. But if *nothing*
 * in a whole region resolves, the ids do not describe this file at all — a
 * typo, a case difference, scientific names against UCSC db names — and the
 * track draws the configured species as labelled rows with not one base under
 * them. The two are indistinguishable to the user and only distinguishable here,
 * where both the file's tokens and the configured ids are in hand.
 *
 * Reported once per fetch, and only in that all-or-nothing case, so a working
 * subset config stays silent. A warning rather than an error because the same
 * shape occurs legitimately when the chosen species simply do not align in the
 * region being viewed — that track is empty either way, and the hint costs it
 * nothing.
 */
export function makeSourceResolver(sampleIds?: Set<string>) {
  const unmatched = new Set<string>()
  let matched = 0
  let seen = 0
  // Memoized because a region has only as many distinct source tokens as it has
  // species-and-contig pairs — a couple dozen — while it has one *row* per
  // species per block, which on a 26-way is tens of thousands. Both resolvers
  // are string walks (`matchSampleId` scans right to left, `parseAssemblyAndChr`
  // hunts dots and runs a regex), so without this they re-derive the same answer
  // for `ce11.chrI` thousands of times per fetch. Every adapter benefits: bigMaf
  // resolves once per s/i/e line, TAF once per row instruction.
  //
  // `matched`/`seen` now count distinct tokens rather than occurrences, which
  // leaves the diagnostic below unchanged — it fires on `matched === 0`, and no
  // token matching is the same statement either way.
  const cache = new Map<string, ParsedAssemblyName | undefined>()
  return {
    resolve(token: string): ParsedAssemblyName | undefined {
      // `has` rather than a `?? compute` fallthrough: undefined is a real,
      // cacheable answer here (a token naming no configured sample), and it is
      // the answer for *every* row of a filtered-out species — exactly the case
      // that most needs to not be recomputed.
      if (cache.has(token)) {
        return cache.get(token)
      }
      let parsed: ParsedAssemblyName | undefined
      if (sampleIds) {
        parsed = matchSampleId(token, sampleIds)
        if (parsed) {
          matched++
        } else {
          seen++
          if (unmatched.size < REPORT_SOURCES) {
            unmatched.add(token)
          }
        }
      } else {
        parsed = parseAssemblyAndChr(token)
      }
      cache.set(token, parsed)
      return parsed
    },
    reportUnmatched() {
      if (sampleIds && matched === 0 && seen > 0) {
        console.warn(
          `MAF: none of the ${sampleIds.size} configured sample ids matched any source in this region, so every row was dropped. ` +
            `Sources in the file look like ${quoteList(unmatched, REPORT_SOURCES, seen)}; ` +
            `configured ids are ${quoteList(sampleIds, REPORT_IDS, sampleIds.size)}. ` +
            'An id must equal the source token up to a dot boundary — "hg38" matches "hg38.chr1", "hg38.1" matches "hg38.1.chr3".',
        )
      }
    },
  }
}

/** The resolving half of `makeSourceResolver`, as the parsers take it. */
export type SourceResolver = ReturnType<typeof makeSourceResolver>['resolve']

/** One parsed species entry of a MAF-tabix feature's encoded alignment list. */
export interface ParsedMafTabixEntry {
  assemblyName: string
  chr: string
  start: number
  /** +1/−1, from the entry's strand field */
  strand: number
  /** total source sequence length, or undefined if absent */
  srcSize: number | undefined
  seq: string
}

/**
 * Parse the `assembly.chr:start:size:strand:srcSize:seq` entry occupying
 * `text[from..to)` — one species of a MAF-tabix feature's comma-joined
 * alignment list — resolving the species through the caller's
 * `makeSourceResolver`. Returns undefined when the entry is malformed or names
 * no known sample. Strand and srcSize are carried because a `−`-strand
 * component's `start` is relative to the reverse complement (needed for correct
 * hover coordinates) and the strand drives the inversion indicator.
 *
 * Takes offsets into the caller's string rather than its own entry string, and
 * finds its fields with `indexOf` rather than `split`, because this is the
 * plugin's hottest text path: one call per species per block, so ~40k calls for
 * a buffered 26-way region. `split(',')` then `split(':')` allocated an array
 * and seven strings per call, of which only two are kept — measured at 152ms
 * against 91ms for this scan over the same region.
 *
 * `seq` runs to `to` rather than to a sixth colon. MAF sequence characters are
 * IUPAC codes plus `-`/`.`, so a colon cannot appear in one, and taking the
 * remainder means a trailing field can't silently truncate the alignment.
 *
 * `size` (field 3) is skipped: the block's genomic extent comes from the
 * reference row's non-dash column count, not from any row's declared size.
 */
export function scanMafTabixEntry(
  text: string,
  from: number,
  to: number,
  resolve: SourceResolver,
): ParsedMafTabixEntry | undefined {
  const c0 = text.indexOf(':', from)
  if (c0 === -1 || c0 >= to || c0 === from) {
    return undefined
  }
  const c1 = text.indexOf(':', c0 + 1)
  const c2 = c1 === -1 ? -1 : text.indexOf(':', c1 + 1)
  const c3 = c2 === -1 ? -1 : text.indexOf(':', c2 + 1)
  const c4 = c3 === -1 ? -1 : text.indexOf(':', c3 + 1)
  // Every field must land inside this entry; `c4 + 1 === to` is an empty seq,
  // which the split-based parser rejected too.
  if (c4 === -1 || c4 >= to || c4 + 1 === to) {
    return undefined
  }
  const parsed = resolve(text.slice(from, c0))
  if (!parsed?.assemblyName) {
    return undefined
  }
  return {
    assemblyName: parsed.assemblyName,
    chr: parsed.chr,
    start: parseInt(text.slice(c0 + 1, c1), 10),
    // Field 3 of six, and a single character, so read it as one rather than
    // slicing a string for `parseStrand` to compare. Same rule as
    // `parseStrand`: anything but `-` is forward.
    strand: text.charCodeAt(c2 + 1) === MINUS_CHAR ? -1 : 1,
    srcSize: parseInt(text.slice(c3 + 1, c4), 10),
    seq: text.slice(c4 + 1, to),
  }
}

/** `-`, the only strand token that means reverse. */
const MINUS_CHAR = 45

/**
 * {@link scanMafTabixEntry} over a standalone entry string. The adapter scans
 * in place; this is for callers that already hold one entry on its own.
 */
export function parseMafTabixEntry(
  elt: string,
  resolve: SourceResolver,
): ParsedMafTabixEntry | undefined {
  return scanMafTabixEntry(elt, 0, elt.length, resolve)
}

/**
 * Selects the appropriate sequence from alignments based on the lookup order:
 * 1. refAssemblyName config value (if provided)
 * 2. query.assemblyName (from the region being queried)
 * 3. firstAssemblyNameFound (fallback to first assembly in data)
 */
export function selectReferenceSequenceString(
  alignments: Record<string, { seq: string }>,
  refAssemblyName: string | undefined,
  queryAssemblyName: string | undefined,
  firstAssemblyNameFound: string | undefined,
): string | undefined {
  for (const name of [
    refAssemblyName,
    queryAssemblyName,
    firstAssemblyNameFound,
  ]) {
    if (name && alignments[name]) {
      return alignments[name].seq
    }
  }
  return undefined
}
