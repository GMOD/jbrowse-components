import { csToCigar } from '@jbrowse/cigar-utils'
import { fetchAndMaybeUnzipText } from '@jbrowse/core/util'

import SyntenyFeature from './SyntenyFeature/index.ts'

import type { BareFeature } from './mcscanUtil.ts'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
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
// so callers can express "no anchor/target supplied".
export function resolvePanSNPrefix(
  adapter: BaseFeatureDataAdapter,
  name: string | undefined,
) {
  return name === undefined
    ? undefined
    : (assemblyNameToPanSN(adapter)[name] ?? name)
}

// PanSN sample prefix (in the PAF) -> JBrowse assembly name, for the listed
// assemblies. Gives a mate a friendly assembly label; a mate whose sample is not
// a listed assembly falls back to the bare prefix (one-vs-all draws against
// every sample in the file, listed or not).
export function assemblyByPanSNPrefix(adapter: BaseFeatureDataAdapter) {
  const map = assemblyNameToPanSN(adapter)
  const out: Record<string, string> = {}
  for (const asm of adapter.getConf('assemblyNames') as string[]) {
    out[map[asm] ?? asm] = asm
  }
  return out
}

export function parseBed(text: string) {
  const result = new Map<string, BareFeature>()
  for (const line of text.split(/\n|\r\n|\r/)) {
    if (line && !line.startsWith('#')) {
      const [refName, start, end, name, score, strand] = line.split('\t')
      if (refName && start && end && name) {
        result.set(name, {
          refName,
          start: +start,
          end: +end,
          score: +(score ?? 0),
          name,
          strand: strand === '-' ? -1 : 1,
        })
      }
    }
  }
  return result
}

export async function readFile(file: GenericFilehandle, opts?: BaseOptions) {
  return fetchAndMaybeUnzipText(file, opts)
}

// Identity in [0,1] from a parsed PAF row's `extra` map. Prefers the
// `de:f:` tag (minimap2 / make-pif gap-compressed divergence) since it is
// computed from the actual CIGAR — same identity source rustybam's `rb stats
// --paf` writes and SVbyEye computes per-bin. Falls back to odgi untangle's
// `id:f:` tag (a percentage or fraction), then to residue matches over block
// length.
export function pafIdentity(
  extra: Record<string, string | number | undefined>,
) {
  if (extra.de !== undefined) {
    const d = +extra.de
    if (Number.isFinite(d) && d >= 0 && d <= 1) {
      return 1 - d
    }
  }
  if (extra.id !== undefined) {
    const v = +extra.id
    if (Number.isFinite(v)) {
      return v > 1 ? v / 100 : v
    }
  }
  const matches = +(extra.numMatches ?? 0)
  const blockLen = +(extra.blockLen ?? 0)
  return blockLen > 0 ? matches / blockLen : 0
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
    indexedStart: r.qstart,
    indexedEnd: r.qend,
    mateName: r.tname,
    mateStart: r.tstart,
    mateEnd: r.tend,
    strand: r.strand,
    extra: r.extra,
  }
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
// coarse tier if make-pif emitted it. In 'auto' mode it is used past the
// bpPerPx threshold; a manual 'coarse' override forces it but still falls back
// to fine when the tier is absent — the alternative would be returning no data.
// Shared by the two indexed PIF adapters.
export function resolveCoarseTier({
  bpPerPx,
  threshold,
  hasCoarseTier,
  lodMode = 'auto',
}: {
  bpPerPx: number | undefined
  threshold: number
  hasCoarseTier: boolean
  lodMode?: BaseOptions['lodMode']
}) {
  const zoomedOut = bpPerPx !== undefined && bpPerPx >= threshold
  return (
    hasCoarseTier && (lodMode === 'coarse' || (lodMode === 'auto' && zoomedOut))
  )
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
  const { numMatches = 0, blockLen = 1, cg, cs, ...rest } = extra
  const CIGAR = cg ?? (typeof cs === 'string' ? csToCigar(cs) : undefined)
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
