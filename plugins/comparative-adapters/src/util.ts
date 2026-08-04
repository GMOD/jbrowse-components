import { csToCigar, pafIdentity } from '@jbrowse/cigar-utils'
import {
  createStatusFanOut,
  downloadStatus,
  fetchAndMaybeUnzipText,
} from '@jbrowse/core/util'
import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'
import {
  checkStopTokenThrottled,
  withStopTokenSignal,
} from '@jbrowse/core/util/stopToken'

import SyntenyFeature from './SyntenyFeature/index.ts'
import { panSNMatchesPrefix, panSNPrefixes } from './pansn.ts'

import type { BareFeature } from './mcscanUtil.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { StatusCallback } from '@jbrowse/core/util'
import type { StopTokenChecker } from '@jbrowse/core/util/stopToken'
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

// PanSN prefix (in the PAF) -> JBrowse assembly name, for the listed assemblies.
// The prefix is whatever the config named, so this map can hold sample-level
// (`grape`) and haplotype-level (`grape#1`) keys at once.
export function assemblyByPanSNPrefix(adapter: BaseFeatureDataAdapter) {
  const map = assemblyNameToPanSN(adapter)
  const out: Record<string, string> = {}
  for (const asm of adapter.getConf('assemblyNames') as string[]) {
    out[map[asm] ?? asm] = asm
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

export function parseBed(text: string) {
  const result = new Map<string, BareFeature>()
  for (const line of text.split(/\n|\r\n|\r/)) {
    if (line && !line.startsWith('#')) {
      const [refName, start, end, name, score, strand] = line.split('\t')
      if (refName && start && end && name) {
        // BED writes an absent score as `.` (and jcvi's BEDs often do), which
        // `+score` turned into a NaN that rode all the way out to the feature
        const numScore = Number(score)
        result.set(name, {
          refName,
          start: +start,
          end: +end,
          score: Number.isFinite(numScore) ? numScore : 0,
          name,
          strand: strand === '-' ? -1 : 1,
        })
      }
    }
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

export function parsePAFLine(line: string) {
  const parts = line.split('\t')
  const extra: Record<string, string | number> = {
    numMatches: +parts[9]!,
    blockLen: +parts[10]!,
    mappingQual: +parts[11]!,
  }

  for (let i = 12; i < parts.length; i++) {
    const field = parts[i]!
    const colonIndex = field.indexOf(':')
    extra[field.slice(0, colonIndex)] = field.slice(colonIndex + 3)
  }

  return {
    tname: parts[5]!,
    tstart: +parts[7]!,
    tend: +parts[8]!,
    qname: parts[0]!,
    qstart: +parts[2]!,
    qend: +parts[3]!,
    strand: parts[4] === '-' ? -1 : 1,
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
export function isSelfDiagonal(a: {
  refName: string
  start: number
  end: number
  mateRefName: string
  mateStart: number
  mateEnd: number
}) {
  return (
    a.refName === a.mateRefName &&
    a.start === a.mateStart &&
    a.end === a.mateEnd
  )
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
  side: {
    refName: string
    start: number
    end: number
    mateRefName: string
    mateStart: number
    mateEnd: number
  },
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
 * Fraction of the shorter of two intervals that they share. 1 when one contains
 * the other, 0 when they are disjoint.
 */
function overlapFraction(
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
 * over 134 kb. Nothing short of near-identity on both sides qualifies, which is
 * what keeps real paralogy (same pair of contigs, different loci) out of it.
 */
const RECIPROCAL_OVERLAP = 0.9

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
 * near-identity on both spans rather than by direction: a file holding only one
 * direction per pair (minimap2 `-X`, or a curated PAF) has no pairs to drop and
 * is untouched, which a "keep only the canonical direction" rule could not
 * promise.
 *
 * Returns a stateful predicate — call it once per side, in a deterministic
 * order, and it answers whether that side is a restatement of one already
 * accepted.
 */
export function createReciprocalDedupe() {
  const kept = new Map<
    string,
    { start: number; end: number; mateStart: number; mateEnd: number }[]
  >()
  return function isDuplicate(side: {
    refName: string
    start: number
    end: number
    mateRefName: string
    mateStart: number
    mateEnd: number
  }) {
    const key = `${side.refName}\u0000${side.mateRefName}`
    const seen = kept.get(key)
    if (
      seen?.some(
        p =>
          overlapFraction(p.start, p.end, side.start, side.end) >=
            RECIPROCAL_OVERLAP &&
          overlapFraction(
            p.mateStart,
            p.mateEnd,
            side.mateStart,
            side.mateEnd,
          ) >= RECIPROCAL_OVERLAP,
      )
    ) {
      return true
    }
    const entry = {
      start: side.start,
      end: side.end,
      mateStart: side.mateStart,
      mateEnd: side.mateEnd,
    }
    if (seen) {
      seen.push(entry)
    } else {
      kept.set(key, [entry])
    }
    return false
  }
}

/**
 * Minimal structural view of `@gmod/tabix`'s `TabixIndexedFile.getLines`, so
 * this signature needn't name the concrete class.
 */
interface PifLineSource {
  getLines(
    refName: string,
    start: number,
    end: number,
    opts: {
      lineCallback: (line: string, fileOffset: number) => void
      onProgress?: (bytesDownloaded: number, totalBytes?: number) => void
      signal?: AbortSignal
    },
  ): Promise<void>
}

/**
 * Read one PIF range under a determinate download bar, parsing each line and
 * checking the stop token as it goes. Shared by the two indexed PIF adapters,
 * which previously wrapped the scan in a bare `updateStatus` — the only tabix
 * adapters left showing a spinner where the rest show bytes, and the only ones
 * that ran a cancelled query to completion.
 */
export function readPifLines({
  pif,
  seqid,
  start,
  end,
  statusCallback,
  stopTokenCheck,
  lineCallback,
}: {
  pif: PifLineSource
  seqid: string
  start: number
  end: number
  statusCallback: StatusCallback
  stopTokenCheck: StopTokenChecker
  lineCallback: (line: PifLine, fileOffset: number) => void
}) {
  // the signal comes off the checker's own token, so the caller passes one
  // cancellation handle rather than two that could disagree
  return withStopTokenSignal(stopTokenCheck.stopToken, signal =>
    downloadStatus('Downloading features', statusCallback, onProgress =>
      pif.getLines(seqid, start, end, {
        onProgress,
        lineCallback: (line, fileOffset) => {
          checkStopTokenThrottled(stopTokenCheck)
          lineCallback(parsePifLine(line), fileOffset)
        },
        signal,
      }),
    ),
  )
}

// A file carries the coarse tier only if make-pif emitted at least one
// uppercase-prefixed (T/Q) seqid. The tier letter is always the first char, so
// a sample whose PanSN name itself starts with T/Q can't false-positive (its
// fine seqid is `t`/`q` + name). Shared by the two indexed PIF adapters.
export function hasCoarseTierPrefix(refSeqNames: string[]) {
  return refSeqNames.some(n => n.startsWith('T') || n.startsWith('Q'))
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
  // `id` is dropped for the reason makeSyntenyFeature drops it: pafIdentity
  // reads it below, and as feature data it would become the feature's `id` and
  // be shown as its name.
  const { numMatches = 0, blockLen = 1, cg, cs, id: _id, ...rest } = extra
  // a PIF row's tags are untyped strings/numbers, so both tags are narrowed
  // rather than assumed to be strings
  const CIGAR =
    typeof cg === 'string'
      ? cg
      : typeof cs === 'string'
        ? csToCigar(cs)
        : undefined
  return new SyntenyFeature({
    uniqueId: fileOffset + assemblyName,
    assemblyName,
    start: indexedStart,
    end: indexedEnd,
    type: 'match',
    refName,
    strand,
    ...rest,
    CIGAR,
    cs: typeof cs === 'string' ? cs : undefined,
    syntenyId: fileOffset,
    identity: pafIdentity(extra),
    numMatches,
    blockLen,
    mate,
  })
}
