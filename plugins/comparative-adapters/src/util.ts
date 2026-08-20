import { csToCigar, pafIdentity } from '@jbrowse/cigar-utils'
import { createStatusFanOut, fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import SyntenyFeature from './SyntenyFeature/index.ts'
import { panSNMatchesPrefix, panSNPrefixes } from './pansn.ts'

import type { BareFeature } from './mcscanUtil.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { GenericFilehandle } from 'generic-filehandle2'

// assemblyNames is ordered [query, target]: index 0 is the PAF/delta/chain
// query, index 1 is the target/reference. This is the reverse of the order
// minimap2/nucmer take their inputs. The queryAssembly/targetAssembly config
// fields are an explicit alternative to the positional array. Do not reorder
// without updating PAFAdapter and the synteny docs.
export function getAssemblyNamesFromConf(adapter: BaseFeatureDataAdapter) {
  const assemblyNames = adapter.getConf('assemblyNames') as string[]
  if (assemblyNames.length === 0) {
    return [
      adapter.getConf('queryAssembly') as string,
      adapter.getConf('targetAssembly') as string,
    ]
  }
  return assemblyNames
}

// The two all-vs-all PAF adapters (in-memory AllVsAllPAFAdapter and
// tabix-indexed AllVsAllIndexedPAFAdapter) share this assembly-name <-> PanSN
// sample-prefix mapping; only the record fetch differs. Free functions rather
// than a shared base class so each adapter keeps its own concrete config type
// and getConf's slot-name typing — a base generic over the config can't prove
// the shared slot names to getConf.

// JBrowse assembly name -> its PanSN sample prefix in the PAF (identity when
// unmapped).
// `?? {}` so an adapter whose schema lacks the slot identity-maps rather than
// throwing a TypeError deep inside a query, which is how this first surfaced.
function assemblyNameToPanSN(adapter: BaseFeatureDataAdapter) {
  return (adapter.getConf('assemblyNameToPanSN') ?? {}) as Record<
    string,
    string
  >
}

// Resolve one assembly name to its PanSN sample prefix; undefined passes through
// so callers can express "no anchor/target supplied". Overloaded so a caller
// with a definite name (the query's own assembly) gets a definite prefix back
// and needn't re-narrow it.
export function resolvePanSNPrefix(
  adapter: BaseFeatureDataAdapter,
  name: string,
): string
export function resolvePanSNPrefix(
  adapter: BaseFeatureDataAdapter,
  name: string | undefined,
): string | undefined
export function resolvePanSNPrefix(
  adapter: BaseFeatureDataAdapter,
  name: string | undefined,
) {
  return name === undefined
    ? undefined
    : (assemblyNameToPanSN(adapter)[name] ?? name)
}

// Memoized per adapter, and safe to be: the map is config-derived, and an edit
// produces a new snapshot, hence a new cache key and a new adapter (see
// dataAdapterCache). Both all-vs-all adapters call this per getFeatures — per
// band, per region, per pan/zoom. Weak so the map dies with the adapter.
const asmByPrefixCache = new WeakMap<
  BaseFeatureDataAdapter,
  Record<string, string>
>()

// PanSN prefix (in the PAF) -> JBrowse assembly name, for the listed assemblies.
// The prefix is whatever the config named, so this map can hold sample-level
// (`grape`) and haplotype-level (`grape#1`) keys at once.
export function assemblyByPanSNPrefix(adapter: BaseFeatureDataAdapter) {
  let out = asmByPrefixCache.get(adapter)
  if (out === undefined) {
    const map = assemblyNameToPanSN(adapter)
    out = {}
    for (const asm of adapter.getConf('assemblyNames') as string[]) {
      out[map[asm] ?? asm] = asm
    }
    asmByPrefixCache.set(adapter, out)
  }
  return out
}

// Give a mate a friendly assembly label. Resolves at the most specific depth the
// config named, so a haplotype-resolved track (`grape#1` and `grape#2` loaded as
// separate assemblies) labels each haplotype distinctly while a sample-level
// track still labels both `grape`. A mate matching no listed assembly falls back
// to its bare sample prefix — one-vs-all draws against every sample in the file,
// listed or not — rather than to the haplotype, which would relabel the mates of
// every existing sample-level track.
export function assemblyForPanSNName(
  asmByPrefix: Record<string, string>,
  mateName: string,
) {
  const prefixes = panSNPrefixes(mateName)
  for (let i = prefixes.length - 1; i >= 0; i--) {
    const asm = asmByPrefix[prefixes[i]!]
    if (asm !== undefined) {
      return asm
    }
  }
  return prefixes[0]!
}

/**
 * What PanSN names a file actually carries: every prefix a query can be
 * addressed by (both depths, so `grape` and `grape#1`), the sample-level ones on
 * their own for reporting, and whether any name is PanSN at all. A sample name
 * never contains the separator — that is what splits it off — so the two depths
 * are told apart by looking for one.
 */
export function panSNInventory(seqNames: Iterable<string>) {
  const prefixes = new Set<string>()
  let anyPanSN = false
  for (const name of seqNames) {
    anyPanSN ||= name.includes('#')
    for (const prefix of panSNPrefixes(name)) {
      prefixes.add(prefix)
    }
  }
  return {
    prefixes,
    samples: [...prefixes].filter(p => !p.includes('#')).sort(),
    anyPanSN,
  }
}

export type PanSNInventory = ReturnType<typeof panSNInventory>

/**
 * What an all-vs-all adapter raises when a query's assembly resolves to a PanSN
 * prefix that names nothing in the file.
 *
 * This is a thrown error rather than an empty result on purpose. Both all-vs-all
 * adapters answer `hasDataForRefName` with `true` unconditionally (deciding it
 * properly is a getFeatures), so nothing downstream filters the track out, and
 * `getRefNames` legitimately returns `[]` for an assembly the file does not
 * cover. A name that does not match therefore used to produce a configured track
 * that drew nothing, reported nothing, and looked exactly like a locus with no
 * alignments. The prefixes are also the one thing the user cannot discover from
 * the UI — no form or config editor lists them — so the message carries them.
 */
export function noPanSNMatchError({
  assemblyName,
  prefix,
  inventory,
}: {
  assemblyName: string
  // the PanSN prefix `assemblyName` resolved to, which is the name itself unless
  // assemblyNameToPanSN mapped it
  prefix: string
  inventory: PanSNInventory
}) {
  const { samples, anyPanSN } = inventory
  const example = samples[0]
  if (example === undefined) {
    return new Error(`This file contains no sequences.`)
  }
  const shown = samples.slice(0, 8)
  const rest = samples.length - shown.length
  const list = `${shown.join(', ')}${rest > 0 ? `, and ${rest} more` : ''}`
  // A file with no separator anywhere is a different mistake with a different
  // remedy — usually a pairwise PAF opened with an all-vs-all adapter — and
  // listing its contigs as if they were samples reads as nonsense.
  return new Error(
    anyPanSN
      ? `No sequences in this file belong to assembly "${assemblyName}"${
          prefix === assemblyName ? '' : ` (PanSN prefix "${prefix}")`
        }. Its samples are: ${list}. If this assembly is one of them under another name, map it with the adapter's assemblyNameToPanSN slot, e.g. {"${assemblyName}": "${example}"}.`
      : `This file's sequence names carry no PanSN sample prefix ("${example}" rather than "${assemblyName}#1#${example}"), so an all-vs-all adapter cannot tell which assembly each side of an alignment belongs to. Use a pairwise adapter for a two-genome PAF, or rewrite the names as sample#haplotype#contig.`,
  )
}

/**
 * Both ends of an all-vs-all `getFeatures` resolved to the PanSN prefixes the
 * file is keyed on, having established that the file holds them.
 *
 * Resolution and validation together, because separating them is what let a
 * getFeatures walk on with an unresolved anchor. Everything downstream indexes
 * on `anchorPrefix`, so it is returned definite: past this call an empty result
 * means the file states no alignment there, which is the one thing a caller is
 * allowed to read as silence.
 *
 * **An anchorless query is an error, not an empty band.** `getRefNames` answers
 * `[]` for a query with no assembly name — the caller has not resolved one yet,
 * and every pairwise adapter says the same. `getFeatures` cannot: it is drawing,
 * `hasDataForRefName` is unconditionally true so nothing upstream filtered the
 * track out, and a band that draws nothing and says nothing is indistinguishable
 * from a locus with no homology. That is the failure mode
 * {@link noPanSNMatchError} exists to prevent, and it was reachable here through
 * a Region whose `assemblyName` is typed `string` but arrives over RPC.
 *
 * `has` and `inventory` differ per adapter — the in-memory one has both in hand
 * from its setup, the indexed one probes a seqid index and pays a fetch for the
 * inventory, which is why that one is a thunk taken only on the failing path.
 */
export async function resolveAllVsAllQuery({
  adapter,
  assemblyName,
  targetAssemblyName,
  has,
  inventory,
}: {
  adapter: BaseFeatureDataAdapter
  assemblyName: string | undefined
  targetAssemblyName: string | undefined
  has: (prefix: string) => boolean
  inventory: () => PanSNInventory | Promise<PanSNInventory>
}) {
  if (assemblyName === undefined) {
    throw new Error(
      'a synteny query must name the assembly it is anchored on; this one named none, so there is no PanSN sample prefix to look its alignments up under',
    )
  }
  const anchorPrefix = resolvePanSNPrefix(adapter, assemblyName)
  const targetPrefix = resolvePanSNPrefix(adapter, targetAssemblyName)
  // Both ends, so a band naming a mistyped assembly says which end is wrong
  // instead of drawing empty.
  for (const [name, prefix] of [
    [assemblyName, anchorPrefix],
    [targetAssemblyName, targetPrefix],
  ] as const) {
    if (name !== undefined && prefix !== undefined && !has(prefix)) {
      throw noPanSNMatchError({
        assemblyName: name,
        prefix,
        inventory: await inventory(),
      })
    }
  }
  return { anchorPrefix, targetPrefix }
}

/**
 * What an all-vs-all adapter raises when both assemblies of a synteny band are
 * in the file but the file states no alignment between them.
 *
 * Distinct from {@link noPanSNMatchError}, which is a misconfigured track. This
 * one is a correctly configured track over a file that is not the complete
 * all-vs-all it is being read as: reference-anchored alignments are the norm
 * (HPRC publishes 465 haplotypes vs GRCh38 alongside the complete all-vs-all),
 * and every pair not involving that reference is absent. Same reason it throws
 * rather than returning empty — the band would otherwise draw nothing and say
 * nothing, which is exactly what a locus with no homology looks like.
 *
 * The remedies are all upstream, which is why none of them is a JBrowse command.
 * Ordering the rows so the shared reference sits between the two assemblies uses
 * the pairs the file does have; a project publishing a complete all-vs-all
 * (HPRC's `hprc25272.aln.paf.gz`) has the missing pairs already; and a cohort
 * larger than three rows is a multiple alignment rather than a stack of pairwise
 * bands, which is what MAF tracks are for.
 */
export function noSuchPairError({
  assemblyName,
  targetAssemblyName,
}: {
  assemblyName: string
  targetAssemblyName: string
}) {
  return new Error(
    `This file contains no alignments between "${assemblyName}" and "${targetAssemblyName}", though both are in it. It is almost certainly reference-anchored rather than a complete all-vs-all, so only pairs involving the reference are present. Either order the synteny rows so that reference sits between these two, use a complete all-vs-all alignment if the project publishes one, or view more than three genomes as a multiple alignment (MAF) rather than a stack of pairwise bands.`,
  )
}

/**
 * The value at `key`, inserting `make()` first if there is none. Nested
 * `Map<string, Map<string, T[]>>` indexes are how every adapter here files a
 * record under (prefix, contig) or (refName, mateRefName), and a Map rather
 * than a joined string key because a contig name can contain any character one
 * would reach for as a separator.
 */
export function getOrCreate<K, V>(map: Map<K, V>, key: K, make: () => V) {
  let value = map.get(key)
  if (value === undefined) {
    value = make()
    map.set(key, value)
  }
  return value
}

/**
 * refName -> the positions in `records` of the rows anchored on it.
 *
 * The in-memory comparative adapters used to answer a region query by walking
 * every record and testing its refName, which is O(records) per region — and
 * the callers ask per region: a whole-genome dotplot fetches one region per
 * visible contig, so a scaffold-level assembly turned one query into hundreds
 * of full scans of the same array. Built once in `setup` — the same move
 * AllVsAllPAFAdapter's own index makes — a query walks one bucket.
 */
export function indexRecordsByName<T>(
  records: T[],
  name: (record: T) => string,
) {
  const index = new Map<string, number[]>()
  for (const [i, record] of records.entries()) {
    getOrCreate(index, name(record), () => []).push(i)
  }
  return index
}

// A whole-number column, read off the text without slicing it out. BED and PAF
// coordinates are both integers, so the digit loop answers every real row;
// anything else falls back to the slice-and-coerce the split-based parses always
// did. Shared by {@link parseBedLine} and {@link parsePAFLine}.
function columnNum(text: string, from: number, to: number) {
  if (to <= from) {
    return Number.NaN
  }
  let n = 0
  for (let i = from; i < to; i++) {
    const digit = text.charCodeAt(i) - 48
    if (digit < 0 || digit > 9) {
      return Number(text.slice(from, to))
    }
    n = n * 10 + digit
  }
  return n
}

// One BED line, given its bounds inside `text`. Tab offsets rather than
// `line.split('\t')`: a gene BED is the largest thing an MCScan track parses
// (jcvi's grape BED is 55,564 rows) and the split allocated a six-element array
// plus six substrings per row to keep four of them.
//
// Interning column 1 was tried here and removed: 33 distinct scaffolds over
// 55,564 rows sounds like it should pay, but the Map lookup per row cost 28%
// (35.6ms -> 46.0ms) and saved no measurable heap, because the strings it
// deduplicates are the short ones V8 allocates flat anyway.
function parseBedLine(
  result: Map<string, BareFeature>,
  text: string,
  pos: number,
  lineEnd: number,
) {
  if (lineEnd <= pos || text.charCodeAt(pos) === 35 /* # */) {
    return
  }
  const t1 = text.indexOf('\t', pos)
  if (t1 <= pos || t1 >= lineEnd) {
    return
  }
  const t2 = text.indexOf('\t', t1 + 1)
  if (t2 <= t1 + 1 || t2 >= lineEnd) {
    return
  }
  const t3 = text.indexOf('\t', t2 + 1)
  if (t3 <= t2 + 1 || t3 >= lineEnd) {
    return
  }
  let t4 = text.indexOf('\t', t3 + 1)
  if (t4 === -1 || t4 > lineEnd) {
    t4 = lineEnd
  }
  if (t4 <= t3 + 1) {
    return
  }
  let t5 = t4 === lineEnd ? lineEnd : text.indexOf('\t', t4 + 1)
  if (t5 === -1 || t5 > lineEnd) {
    t5 = lineEnd
  }
  let t6 = t5 === lineEnd ? lineEnd : text.indexOf('\t', t5 + 1)
  if (t6 === -1 || t6 > lineEnd) {
    t6 = lineEnd
  }
  const name = text.slice(t3 + 1, t4)
  // BED writes an absent score as `.` (and jcvi's BEDs often do), which
  // coercing turned into a NaN that rode all the way out to the feature
  const score = columnNum(text, t4 + 1, t5)
  result.set(name, {
    refName: text.slice(pos, t1),
    start: columnNum(text, t1 + 1, t2),
    end: columnNum(text, t2 + 1, t3),
    score: Number.isFinite(score) ? score : 0,
    name,
    // the column is `-` and nothing else, so a `-` with anything after it is
    // not a minus strand
    strand: t6 - t5 === 2 && text.charCodeAt(t5 + 1) === 45 ? -1 : 1,
  })
}

export function parseBed(text: string) {
  const result = new Map<string, BareFeature>()
  // A file whose only terminator is a lone CR (classic Mac) splits first — it
  // is rare enough not to be worth a second cursor in the walk, and scanning
  // for the next CR from every line is quadratic when the file holds none.
  if (!text.includes('\n') && text.includes('\r')) {
    for (const line of text.split('\r')) {
      parseBedLine(result, line, 0, line.length)
    }
    return result
  }
  const len = text.length
  let pos = 0
  while (pos < len) {
    let nl = text.indexOf('\n', pos)
    if (nl === -1) {
      nl = len
    }
    parseBedLine(
      result,
      text,
      pos,
      nl > pos && text.charCodeAt(nl - 1) === 13 /* \r */ ? nl - 1 : nl,
    )
    pos = nl + 1
  }
  return result
}

/**
 * Download a set of files at once (MCScan's BED sidecars plus its
 * anchors/blocks file). They share one status field, so each gets its own
 * {@link createStatusFanOut} slot: unslotted, the downloads took turns
 * overwriting it and the first to finish blanked the label while the rest were
 * still running. Aggregated they read as one Σbytes bar.
 */
export function readFiles(files: GenericFilehandle[], opts?: BaseOptions) {
  const slot = createStatusFanOut(opts?.statusCallback)
  return Promise.all(
    files.map(file =>
      fetchAndMaybeUnzipText(file, { ...opts, statusCallback: slot() }),
    ),
  )
}

/**
 * Parse a whole flat file into records, one line at a time, under a determinate
 * `label`d progress bar. `parseLine` returning undefined skips the line
 * (comments, malformed rows).
 */
export function collectLines<T>({
  buffer,
  label,
  parseLine,
  opts,
}: {
  buffer: Uint8Array
  label: string
  parseLine: (line: string) => T | undefined
  opts?: BaseOptions
}) {
  const records: T[] = []
  parseLineByLine(
    buffer,
    line => {
      const record = parseLine(line)
      if (record !== undefined) {
        records.push(record)
      }
      return true
    },
    opts?.statusCallback,
    { label, stopToken: opts?.stopToken },
  )
  return records
}

// A row missing one of PAF's 12 mandatory columns, which therefore carries no
// optional tags either (they are columns 13 and up). Coercing the absent columns
// is what the split-based parse did with them — `+undefined` is NaN, a missing
// name is undefined — and callers already tolerate that, so the degenerate row
// keeps its answer rather than acquiring a new one.
function parseShortPAFLine(line: string) {
  const parts = line.split('\t')
  return {
    tname: parts[5]!,
    tstart: +parts[7]!,
    tend: +parts[8]!,
    qname: parts[0]!,
    qstart: +parts[2]!,
    qend: +parts[3]!,
    strand: parts[4] === '-' ? -1 : 1,
    extra: {
      numMatches: +parts[9]!,
      blockLen: +parts[10]!,
      mappingQual: +parts[11]!,
    } as Record<string, string | number>,
  }
}

// One PAF (or PIF) row, walked by tab offset rather than `line.split('\t')`.
// The split allocated the whole column array plus a substring per column to keep
// six of them, and on a fine-tier PIF row it did that around a CIGAR that is
// most of the line: `hs1ToMm39.over.chain.pif.gz` averages 1,789 bytes a row, so
// the split was scanning and re-wrapping ~1.7kB per row to read twelve short
// fields off the front. Measured 1.84x on that file's fine and coarse tiers and
// 1.49x on a 10-tag minimap2 PAF —
// `plugins/comparative-adapters/benches/pafLineParse.bench.ts`.
//
// The offsets must strictly increase, and testing that is not decoration:
// `indexOf` answers -1 at the end of a short row, and the next call then reads
// `indexOf('\t', -1 + 1)`, which restarts the search at 0 and silently returns
// offsets from the front of the line again. The first -1 always breaks the
// chain, so one monotonic test catches every short row.
export function parsePAFLine(line: string) {
  const len = line.length
  const t0 = line.indexOf('\t')
  const t1 = line.indexOf('\t', t0 + 1)
  const t2 = line.indexOf('\t', t1 + 1)
  const t3 = line.indexOf('\t', t2 + 1)
  const t4 = line.indexOf('\t', t3 + 1)
  const t5 = line.indexOf('\t', t4 + 1)
  const t6 = line.indexOf('\t', t5 + 1)
  const t7 = line.indexOf('\t', t6 + 1)
  const t8 = line.indexOf('\t', t7 + 1)
  const t9 = line.indexOf('\t', t8 + 1)
  const t10 = line.indexOf('\t', t9 + 1)
  if (
    !(
      t0 < t1 &&
      t1 < t2 &&
      t2 < t3 &&
      t3 < t4 &&
      t4 < t5 &&
      t5 < t6 &&
      t6 < t7 &&
      t7 < t8 &&
      t8 < t9 &&
      t9 < t10
    )
  ) {
    return parseShortPAFLine(line)
  }
  // the last mandatory column runs to the end of the line when the row states
  // no optional tags at all
  let t11 = line.indexOf('\t', t10 + 1)
  if (t11 === -1) {
    t11 = len
  }
  const extra: Record<string, string | number> = {
    numMatches: columnNum(line, t8 + 1, t9),
    blockLen: columnNum(line, t9 + 1, t10),
    mappingQual: columnNum(line, t10 + 1, t11),
  }

  let pos = t11 + 1
  while (pos < len) {
    let end = line.indexOf('\t', pos)
    if (end === -1) {
      end = len
    }
    // `TAG:t:value`, so the first colon ends the tag name and the value starts
    // two characters later — a `cs` value's own colons are inside the value. A
    // column that is not a tag at all is skipped rather than filed under a
    // truncated key: it would otherwise be copied onto the feature and shown in
    // the tooltip as a garbage field.
    const colon = line.indexOf(':', pos)
    if (colon !== -1 && colon < end) {
      extra[line.slice(pos, colon)] = line.slice(colon + 3, end)
    }
    pos = end + 1
  }

  return {
    tname: line.slice(t4 + 1, t5),
    tstart: columnNum(line, t6 + 1, t7),
    tend: columnNum(line, t7 + 1, t8),
    qname: line.slice(0, t0),
    qstart: columnNum(line, t1 + 1, t2),
    qend: columnNum(line, t2 + 1, t3),
    // the column is `-` and nothing else, so a `-` with anything after it is not
    // a minus strand
    strand: t4 - t3 === 2 && line.charCodeAt(t3 + 1) === 45 ? -1 : 1,
    extra,
  }
}

// A PIF row is a PAF row pre-oriented to the perspective it is indexed under:
// columns 1-4 are always the indexed ("anchor") feature — column 1 carries a
// tier-letter prefix (fine q/t, coarse Q/T) — and columns 6/8/9 are the mate
// (no prefix). So the PAF "query" columns hold the anchor whichever perspective
// was indexed, and the CIGAR is already swapped/flipped for it. This renames
// parsePAFLine's q*/t* fields to the anchor/mate roles they actually play here,
// which is why the indexed adapters need no read-time reorientation.
export function parsePifLine(line: string) {
  const r = parsePAFLine(line)
  return {
    indexedName: r.qname,
    // The tier letter stripped once, here, where it is what column 1 means —
    // rather than at each read site, which is where a `.slice(1)` is easy to
    // forget and impossible to tell from an off-by-one.
    indexedRefName: r.qname.slice(1),
    indexedStart: r.qstart,
    indexedEnd: r.qend,
    mateName: r.tname,
    mateStart: r.tstart,
    mateEnd: r.tend,
    strand: r.strand,
    extra: r.extra,
  }
}

/** A PIF row parsed into its anchor/mate roles — see {@link parsePifLine}. */
export type PifLine = ReturnType<typeof parsePifLine>

/**
 * Whether an all-vs-all row is a degenerate self-diagonal: the SAME sequence
 * aligned to itself at the same coordinates, which minimap2 emits once per
 * sequence unless run with `-X`. Dropped from both of its sides.
 *
 * The test is on the full PanSN names, not sample + stripped contig:
 * `grape#1#chr1` vs `grape#2#chr1` shares both of those yet is a real
 * hap1-vs-hap2 alignment, and two samples that share a contig name (both
 * `chr1`) can align at identical coordinates in a conserved region. Shared by
 * the in-memory and indexed all-vs-all adapters so that reasoning lives once.
 */
export function isSelfDiagonal(a: AlignedSide) {
  return (
    a.refName === a.mateRefName &&
    a.start === a.mateStart &&
    a.end === a.mateEnd
  )
}

/**
 * One side of one all-vs-all alignment: the locus it draws at plus the locus it
 * draws to, both under their full PanSN names. The in-memory adapter builds this
 * by orienting a PAF record ({@link orientPafRecord}); the indexed one reads it
 * straight off a PIF row, which make-pif already oriented. Every predicate below
 * is stated over this shape so the two adapters cannot answer differently.
 */
export interface AlignedSide {
  refName: string
  start: number
  end: number
  mateRefName: string
  mateStart: number
  mateEnd: number
  /**
   * +1/-1 from the PAF/PIF record, and it is orientation-symmetric: flipping a
   * record to the other perspective does not change whether the two sequences
   * run the same way. Only {@link sharesBoundary} reads it, which is why it is
   * optional -- a side built without it is treated as forward, the behaviour
   * every caller had before the field existed.
   */
  strand?: number
}

/**
 * Whether one side of an all-vs-all record draws in the current query.
 *
 * `anchorPrefix` is the assembly being viewed and `targetPrefix` the assembly on
 * the other band of a two-row synteny view, or `undefined` for the one-vs-all
 * case a plain linear view asks for — which draws every mate, listed as an
 * assembly or not. Narrowing to a target also excludes same-sample paralogy,
 * since there the mate is the anchor's own sample rather than the other band.
 *
 * One predicate so `getFeatures` and `getRefNames` cannot answer it differently:
 * a contig reported as having data but yielding no features is exactly the
 * divergence this prevents.
 */
export function sideDraws(
  side: AlignedSide,
  anchorPrefix: string | undefined,
  targetPrefix: string | undefined,
) {
  return (
    !isSelfDiagonal(side) &&
    panSNMatchesPrefix(side.refName, anchorPrefix) &&
    (targetPrefix === undefined ||
      panSNMatchesPrefix(side.mateRefName, targetPrefix))
  )
}

/**
 * How much of the SHORTER of two intervals the pair shares. 1 when either
 * contains the other, 0 when disjoint.
 *
 * Containment rather than Jaccard, because the two directions of an all-vs-all
 * mapping do not always CHAIN a homology the same way. wfmash states K12 against
 * NCTC86 once from K12 — one 610 kb block — and twice from NCTC86, as 197 kb and
 * 392 kb split at a joint the other pass ran straight through. Against the union
 * the long side scores 0.32 against either fragment, so all three survive and
 * every base a fragment covers is painted twice: exactly the doubled alpha this
 * pass exists to remove, and the one that was left ("some ribbons are darker
 * than others weirdly").
 *
 * What Jaccard was protecting was a short block nested inside a long one on both
 * spans — a repeat inside a syntenic block, a minimap2 secondary inside its
 * primary — which containment alone reads as a perfect match. {@link
 * sharesBoundary} is what excludes those instead, and it is the better test: two
 * rows are one homology because they sit on the same diagonal, not because one
 * happens to fit inside the other.
 */
function containedFraction(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
  const shorter = Math.min(aEnd - aStart, bEnd - bStart)
  return shorter > 0 ? Math.max(0, overlap) / shorter : 0
}

/**
 * How much two sides must agree, on BOTH of their spans, to be one homology
 * stated twice. Reciprocal alignments are the same aligner run from either end,
 * so they agree to within a few bases over hundreds of kb — the E. coli wfmash
 * pair that prompted this differs by 4 bp on one side and 513 on the other,
 * over 134 kb. Nothing short of near-containment on both sides qualifies, which
 * is what keeps real paralogy (same pair of contigs, different loci) out of it.
 */
const RECIPROCAL_OVERLAP = 0.9

/**
 * How far two sides' ref-to-mate offsets may differ at the end they share, in
 * bp, and still be one homology. Capped rather than purely proportional: the
 * agreement is a property of the boundary, not of the block, so a longer
 * alignment does not license a looser one. The fraction is what keeps the cap
 * from swallowing short blocks — two 500 bp alignments nested in each other 800
 * bp off the diagonal are two alignments.
 */
const BOUNDARY_SLACK_BP = 1000
const BOUNDARY_SLACK_FRACTION = 0.02

/**
 * Whether two sides place the homology at the same offset at either of their
 * ends. One chaining of an alignment and a longer chaining of the same one
 * coincide exactly where they both begin (or both end) and diverge after that,
 * so a fragment agrees with its parent at one end and nowhere else — which is
 * why this takes the better of the two rather than requiring both.
 *
 * Indels are why it cannot be asked of the interior: over the 610 kb E. coli
 * block the two passes drift ~12 kb apart in the middle while agreeing to
 * within 40 bp at the shared end.
 *
 * **ORIENTATION IS PART OF THE TEST, and getting it wrong is invisible except
 * in an inversion.** The offsets above only cancel when the two sequences run
 * the same way. On a reverse-strand alignment the anchor's low end is the
 * mate's HIGH end, so a fragment that starts 10 kb into its parent ends 10 kb
 * short of the parent's `mateEnd` and has a `mateStart` belonging to the
 * opposite end of the block entirely — the forward form then measures a
 * mismatch the size of the block and reports "not a restatement" for every
 * inverted pair. That is exactly the residue this left behind: after the
 * forward-only version of this test, `pangenome/pggb_synteny`'s three
 * collinear bands composited at the intended 0.2 alpha and its one inverted
 * band (NCTC86/IAI39) still ran 8.3% of its red area at 1-(1-0.2)^2 and 1% at
 * three coats — "there are still darker-than-normal lines in the last row of
 * inversion".
 *
 * A side with no `strand` is read as forward, which is what every caller that
 * does not set it already assumed.
 */
function sharesBoundary(a: AlignedSide, b: AlignedSide) {
  // Two sides that disagree about orientation are not one homology however
  // well their spans nest: a forward and a reverse alignment of the same pair
  // of loci are two different statements.
  if ((a.strand ?? 1) !== (b.strand ?? 1)) {
    return false
  }
  const reversed = (a.strand ?? 1) < 0
  // On a reverse diagonal the anchor's start pairs with the mate's END, so the
  // two deltas ADD to zero where a forward pair's SUBTRACT to zero.
  const atStart = reversed
    ? Math.abs(b.start - a.start + (b.mateEnd - a.mateEnd))
    : Math.abs(b.start - a.start - (b.mateStart - a.mateStart))
  const atEnd = reversed
    ? Math.abs(b.end - a.end + (b.mateStart - a.mateStart))
    : Math.abs(b.end - a.end - (b.mateEnd - a.mateEnd))
  const shorter = Math.min(a.end - a.start, b.end - b.start)
  return (
    Math.min(atStart, atEnd) <=
    Math.min(BOUNDARY_SLACK_BP, BOUNDARY_SLACK_FRACTION * shorter)
  )
}

/** How much of the anchor a side covers, which is what decides a tie. */
function refSpan(a: AlignedSide) {
  return a.end - a.start
}

/**
 * Two sides are one homology stated twice when each span nearly contains the
 * other and they meet on the same diagonal.
 */
function isRestatement(a: AlignedSide, b: AlignedSide) {
  return (
    containedFraction(a.start, a.end, b.start, b.end) >= RECIPROCAL_OVERLAP &&
    containedFraction(a.mateStart, a.mateEnd, b.mateStart, b.mateEnd) >=
      RECIPROCAL_OVERLAP &&
    sharesBoundary(a, b)
  )
}

/**
 * Total order on the sides of one contig pair. Ascending start is what the sweep
 * in {@link markReciprocalDuplicates} needs; the rest only has to be a tiebreak
 * that does not depend on the order the sides arrived in.
 */
function cmpSide(a: AlignedSide, b: AlignedSide) {
  return (
    a.start - b.start ||
    a.end - b.end ||
    a.mateStart - b.mateStart ||
    a.mateEnd - b.mateEnd
  )
}

/**
 * An all-vs-all mapping contains a record per ORDERED pair, so A-vs-B and
 * B-vs-A are both in the file — two alignments of one homology, computed from
 * either end and therefore not byte-identical. Both are anchored on A when A is
 * the row being drawn, so a synteny band paints the same ribbon twice: at the
 * default alpha two coats composite to 0.36 where every other synteny figure
 * sits at 0.2, which is how this was noticed ("the polygons are oddly darker
 * than expected ... plotted twice from all-vs-all").
 *
 * Drawing both is not more information — it is the same statement in two
 * coordinates — and it makes a band's colour a function of how the file was
 * generated rather than of what aligned. So one of each pair is dropped, by
 * coincidence on both spans rather than by direction: a file holding only one
 * direction per pair (minimap2 `-X`, or a curated PAF) has no pairs to drop and
 * is untouched, which a "keep only the canonical direction" rule could not
 * promise.
 *
 * **The two directions need not pair up one for one.** A pass from either end
 * chains the same alignments differently, so one direction's block can be
 * another's two — the E. coli graph's own file states K12/NCTC86 as 12 blocks
 * from K12 and 14 from NCTC86. A rule that only recognised equal spans left
 * those and drew them over their parent, which is why the doubled ink survived a
 * round of this. {@link isRestatement} therefore asks whether one side sits
 * inside the other on both axes AND meets it on the same diagonal, and the
 * longer chaining is the one kept.
 *
 * Keeping one statement of a homology is not free at the edges, and the price is
 * worth stating: over the whole E. coli file this halves the rows (1,012 sides
 * to 545) and the union of what is drawn loses 33,924 bp of 90.9 Mb — 0.037%,
 * as 154 slivers with a median of 41 bp, where the dropped chaining reached a
 * little past the kept one. They abut a kept block rather than opening a hole in
 * one, and every one of them is sub-pixel at any width a band is read at.
 *
 * **A reversed restatement was invisible to the first version of this** — see
 * {@link sharesBoundary}. Over the same file, making the boundary test
 * orientation-aware drops 490 sides where the forward-only form dropped 474,
 * and all sixteen are in the four pairs that carry an inversion (IAI39 against
 * K12, NCTC86 and Sakai, plus NCTC86/Sakai); the six pairs with no reversed
 * side are byte-identical. On `pangenome/pggb_synteny` the inverted band's
 * double-coated red area went 8.32% -> 2.95% and its triple-coated area 1% ->
 * 0, with the three collinear bands unmoved. What is left is ribbons genuinely
 * crossing each other at the inversion, which is what alpha is for.
 *
 * Returns a mask parallel to `sides`: true where that side restates another in
 * its contig pair.
 *
 * A batch pass over a whole set rather than a predicate fed one side at a time,
 * because both properties of the streaming form were bugs:
 *
 *  - **Which member survived depended on arrival order.** The in-memory adapter
 *    walked records in file order and the indexed one in (tier letter, file
 *    offset) order, so one file drew a different member of each pair — different
 *    CIGAR, coordinates off by a few hundred bases — depending on which adapter
 *    was loaded. Sorting here makes it a property of the alignment instead.
 *  - **It was quadratic.** Compared against every side already kept for the
 *    pair, one contig pair holding 50k alignments cost 4.6s — and paid it per
 *    region, per band, per pan/zoom. Swept in ascending start, a side can only
 *    restate one that still reaches it, so the pass prunes on `end <= start` and
 *    compares against the active set alone.
 *
 * Callers run this once over a whole file (the in-memory adapter's `setupPre`)
 * or once over a whole query result, never per feature.
 */
export function markReciprocalDuplicates(sides: AlignedSide[]) {
  const duplicate = new Array<boolean>(sides.length).fill(false)
  // A restatement necessarily shares both contig names, so only sides of the
  // same pair are candidates for each other. Nested maps rather than a joined
  // string key: a contig name can contain any of the characters one would
  // reach for as a separator.
  const byPair = new Map<string, Map<string, number[]>>()
  for (const [i, side] of sides.entries()) {
    const byMate = getOrCreate(byPair, side.refName, () => new Map())
    getOrCreate(byMate, side.mateRefName, () => []).push(i)
  }

  for (const byMate of byPair.values()) {
    for (const group of byMate.values()) {
      group.sort((a, b) => cmpSide(sides[a]!, sides[b]!))
      // Kept sides that still reach the sweep position. Sides arrive in
      // ascending start, so one whose end has been passed can never overlap
      // again.
      const active: number[] = []
      for (const i of group) {
        const side = sides[i]!
        let write = 0
        for (const kept of active) {
          if (sides[kept]!.end > side.start) {
            active[write++] = kept
          }
        }
        active.length = write
        const slot = active.findIndex(kept => isRestatement(sides[kept]!, side))
        if (slot === -1) {
          active.push(i)
          continue
        }
        // The LONGER chaining wins, not the earlier one. A fragment sorts ahead
        // of its parent whenever it starts a few bases sooner, so keeping the
        // one already in hand would throw away the aligner's own chaining and
        // leave the parent's span drawn as pieces with a hole where the two
        // fragments meet. Length is a property of the alignment, so which member
        // survives still does not depend on arrival order.
        const kept = active[slot]!
        if (refSpan(side) > refSpan(sides[kept]!)) {
          duplicate[kept] = true
          active[slot] = i
        } else {
          duplicate[i] = true
        }
      }
    }
  }
  return duplicate
}

// The coarse (uppercase T/Q) tier is a no-CIGAR summary served when zoomed out;
// the fine (lowercase t/q) tier carries per-row CIGARs. A file only has the
// coarse tier if make-pif emitted it, so a request for 'coarse' still falls back
// to fine when the tier is absent — the alternative would be returning no data.
//
// The zoom-based `auto` decision is deliberately NOT here: it is resolved on the
// main thread by `resolveLodTier`, where it can reach the fetch cache key. See
// BaseOptions.lodMode. Shared by the two indexed PIF adapters.
export function resolveCoarseTier({
  hasCoarseTier,
  lodMode,
}: {
  hasCoarseTier: boolean
  lodMode?: BaseOptions['lodMode']
}) {
  return hasCoarseTier && lodMode === 'coarse'
}

/**
 * Copy a row's remaining optional tags onto a synteny feature's data, so they
 * reach the tooltip and the feature-detail card.
 *
 * A loop rather than the `{...known, ...rest, ...more}` spread both feature
 * builders used to write. A spread in the MIDDLE of an object literal is what
 * costs: V8 cannot give the literal a static hidden class, so every field after
 * the spread is added dynamically, once per feature. Building the whole literal
 * statically and copying the tags on afterwards measured 2.0-5.2x on the object
 * construction alone (`benches/pafLineParse.bench.ts`), which is the larger half
 * of the read path — bigger than the parse it follows.
 *
 * `cg`/`cs` are excluded because the caller has already turned them into
 * `CIGAR`/`cs`, and `id` (odgi untangle's identity tag) because `pafIdentity`
 * reads it and as feature data it would become the feature's `id`, which the
 * synteny tooltip falls back to for a name — a row tagged `id:f:0.98` labelled
 * itself "0.98".
 *
 * A tag colliding with a field already set is dropped rather than overwriting
 * it, which is what listing those fields after the spread did.
 */
export function copyPafTags(
  data: SimpleFeatureSerialized,
  extra: Record<string, string | number | undefined>,
) {
  for (const key in extra) {
    if (
      key !== 'cg' &&
      key !== 'cs' &&
      key !== 'id' &&
      !Object.hasOwn(data, key)
    ) {
      data[key] = extra[key]
    }
  }
}

// Build a SyntenyFeature from a parsed PIF row. Unlike the in-memory adapters'
// makeSyntenyFeature, no read-time reorientation happens: make-pif already
// oriented the CIGAR/cs for the indexed perspective, so cg (or a hand-built cs)
// passes straight through. The caller supplies refName and mate because those
// differ per adapter (raw prefix-strip vs PanSN sample/contig split).
export function makeIndexedSyntenyFeature({
  line,
  fileOffset,
  assemblyName,
  refName,
  mate,
}: {
  line: ReturnType<typeof parsePifLine>
  fileOffset: number
  assemblyName: string
  refName: string
  mate: { start: number; end: number; refName: string; assemblyName: string }
}) {
  const { extra, strand, indexedStart, indexedEnd } = line
  const { numMatches = 0, blockLen = 1, cg, cs } = extra
  // a PIF row's tags are untyped strings/numbers, so both tags are narrowed
  // rather than assumed to be strings
  const CIGAR =
    typeof cg === 'string'
      ? cg
      : typeof cs === 'string'
        ? csToCigar(cs)
        : undefined
  const data: SimpleFeatureSerialized = {
    uniqueId: fileOffset + assemblyName,
    assemblyName,
    start: indexedStart,
    end: indexedEnd,
    type: 'match',
    refName,
    strand,
    CIGAR,
    cs: typeof cs === 'string' ? cs : undefined,
    syntenyId: fileOffset,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate,
  }
  copyPafTags(data, extra)
  return new SyntenyFeature(data)
}
