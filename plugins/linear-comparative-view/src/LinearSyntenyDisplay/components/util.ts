import { toLocale } from '@jbrowse/core/util'
import {
  axisSpan,
  genesSharing,
  syntenyBlockLines,
} from '@jbrowse/synteny-core'

import {
  KIND_BASE_TILE,
  KIND_CIGAR_D,
  KIND_CIGAR_I,
  KIND_CIGAR_N,
  KIND_MARKER,
} from '../../LinearSyntenyRPC/syntenyKinds.ts'

import type { SyntenyGeometry } from '../../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { FeatPos, SyntenyFeatureData } from '../model.ts'
import type { SyntenyPickWithin } from '../syntenyRenderingBackendTypes.ts'
import type { SpanAxis, SyntenyBlockSide } from '@jbrowse/synteny-core'

export interface ClickCoord {
  clientX: number
  clientY: number
  feature: FeatPos
}

export interface CigarOpInfo {
  op: string
  length: number
}

const CIGAR_KIND_LETTER: Record<number, string> = {
  [KIND_CIGAR_I]: 'I',
  [KIND_CIGAR_D]: 'D',
  [KIND_CIGAR_N]: 'N',
}

// Resolve the CIGAR operator under the hovered GPU instance. Indel/skip tiles
// (KIND_CIGAR_I/D/N) are emitted on top of the KIND_BASE block, so the picked
// instance index lands on the tile directly. The op length in bp is the span
// of whichever axis advanced: deletions/skips advance loc1 (bp1→bp2),
// insertions advance loc2 (bp3→bp4); the other axis stays a point. See
// visitCigarRenderedSegments + buildSyntenyGeometry.addInstance.
export function getCigarOpAtInstance(
  data: SyntenyGeometry,
  i: number,
): CigarOpInfo | undefined {
  const op = CIGAR_KIND_LETTER[data.kinds[i]!]
  if (!op) {
    return undefined
  }
  // Window-relative bp; the op length is a within-axis span, so the per-axis
  // base cancels in the subtraction (bp1/bp2 share base0, bp3/bp4 share base1).
  const bp1 = data.bp1[i]!
  const bp2 = data.bp2[i]!
  const bp3 = data.bp3[i]!
  const bp4 = data.bp4[i]!
  const length = Math.round(Math.max(Math.abs(bp2 - bp1), Math.abs(bp3 - bp4)))
  return { op, length }
}

// The indel left see-through between tile `i` and the next tile of its feature:
// what the query row advances alone is deleted, what the target row advances
// alone is inserted, and a deletion meeting an insertion is both.
function getGapOpsAfterInstance(data: SyntenyGeometry, i: number) {
  const { bp1, bp2, bp3, bp4 } = data
  return [
    { op: 'D', length: Math.round(Math.abs(bp1[i + 1]! - bp2[i]!)) },
    { op: 'I', length: Math.round(Math.abs(bp4[i + 1]! - bp3[i]!)) },
  ].filter(op => op.length > 0)
}

export function getCigarOpsAt(
  data: SyntenyGeometry,
  i: number,
  within: SyntenyPickWithin,
): CigarOpInfo[] {
  const op = within === 'instance' ? getCigarOpAtInstance(data, i) : undefined
  return within === 'gap' ? getGapOpsAfterInstance(data, i) : op ? [op] : []
}

// The run of match tiles meeting edge to edge that tile `i` is in. A tile is a
// pixel of the walk, not a stretch of the alignment: the run is what lies
// between two indels the view draws.
function tileStretch(data: SyntenyGeometry, i: number) {
  const { kinds, instanceFeatureIdx, bp1, bp2, bp3, bp4 } = data
  const isTile = (k: number) =>
    kinds[k] === KIND_BASE_TILE &&
    instanceFeatureIdx[k] === instanceFeatureIdx[i]
  const meets = (a: number, b: number) =>
    isTile(a) && isTile(b) && bp2[a] === bp1[b] && bp3[a] === bp4[b]
  let first = i
  let last = i
  while (meets(first - 1, first)) {
    first--
  }
  while (meets(last, last + 1)) {
    last++
  }
  return isTile(i) ? { first, last } : undefined
}

// A corner lane is a float32 offset from the fetch window's start, so an end
// read back off it is within this of the bp it was written from.
function laneTolerance(...offsets: number[]) {
  return Math.max(1, ...offsets.map(offset => Math.abs(offset) * 2 ** -22))
}

function snapToWhole(
  span: { start: number; end: number },
  whole: { start: number; end: number },
  tolerance: number,
) {
  const atStart = Math.abs(span.start - whole.start) <= tolerance
  const atEnd = Math.abs(span.end - whole.end) <= tolerance
  return {
    start: atStart ? whole.start : span.start,
    end: atEnd ? whole.end : span.end,
    endsReached: Number(atStart) + Number(atEnd),
  }
}

/**
 * The two sides of the stretch of matches tile `i` is in, or undefined where
 * the stretch is the whole alignment or cannot be told from it.
 *
 * An end of the stretch is known where the feature goes on past it, which is
 * an indel, or where it is the alignment's own end. An end with neither is
 * where the fetch clipped a long alignment to its window, and the stretch runs
 * on from there by an amount the main thread does not hold.
 */
export function getStretchSides(
  data: SyntenyGeometry,
  i: number,
  feat: FeatPos,
  rows: { v0: SpanAxis; v1: SpanAxis },
): SyntenyBlockSide[] | undefined {
  const stretch = tileStretch(data, i)
  if (!stretch) {
    return undefined
  }
  const { first, last } = stretch
  const { kinds, instanceFeatureIdx, bp1, bp2, bp3, bp4, base0, base1 } = data
  const goesOn = (k: number) =>
    kinds[k] !== undefined &&
    kinds[k] !== KIND_MARKER &&
    instanceFeatureIdx[k] === instanceFeatureIdx[i]
  const openEnds = Number(!goesOn(first - 1)) + Number(!goesOn(last + 1))
  const query = snapToWhole(
    axisSpan(bp1[first]! + base0, bp2[last]! + base0, rows.v0),
    feat,
    laneTolerance(bp1[first]!, bp2[last]!),
  )
  const mate = snapToWhole(
    axisSpan(bp4[first]! + base1, bp3[last]! + base1, rows.v1),
    feat.mate,
    laneTolerance(bp4[first]!, bp3[last]!),
  )
  const known = query.endsReached >= openEnds && mate.endsReached >= openEnds
  const whole = query.endsReached === 2 && mate.endsReached === 2
  return known && !whole
    ? [
        {
          assemblyName: feat.assemblyName,
          name: feat.name,
          refName: feat.refName,
          start: query.start,
          end: query.end,
        },
        {
          assemblyName: feat.mate.assemblyName,
          name: feat.mate.name,
          refName: feat.mate.refName,
          start: mate.start,
          end: mate.end,
        },
      ]
    : undefined
}

// A payload side's own assembly lane, resolved to an id once per assembly
function onPayloadAssembly(
  assemblyNameDict: readonly string[],
  assemblyNameIds: Uint32Array,
) {
  return (assemblyName: string) => {
    const id = assemblyNameDict.indexOf(assemblyName)
    return (i: number) => assemblyNameIds[i] === id
  }
}

export function sharedByOf(data: SyntenyFeatureData, feat: FeatPos) {
  return genesSharing(
    {
      lanes: data,
      query: onPayloadAssembly(data.assemblyNameDict, data.assemblyNameIds),
      mate: onPayloadAssembly(
        data.mateAssemblyNameDict,
        data.mateAssemblyNameIds,
      ),
    },
    [feat, feat.mate],
  )
}

// The hovered ribbon's tooltip, as LINES rather than a `<br/>`-joined HTML
// string, which `ComparativeTooltip` renders as text nodes. The block's
// description is synteny-core's, which the linear view's synteny hover shows
// too, so one block reads the same in both; this view adds the CIGAR operator
// under the cursor, and names the stretch of matches under it where the
// alignment is drawn as several.
export function getTooltipLines({
  feat,
  cigarOps = [],
  sharedBy,
  segment,
}: {
  feat: FeatPos
  cigarOps?: readonly CigarOpInfo[]
  sharedBy?: readonly string[]
  segment?: readonly SyntenyBlockSide[]
}) {
  return [
    ...syntenyBlockLines({
      sides: [
        {
          assemblyName: feat.assemblyName,
          name: feat.name,
          refName: feat.refName,
          start: feat.start,
          end: feat.end,
        },
        {
          assemblyName: feat.mate.assemblyName,
          name: feat.mate.name,
          refName: feat.mate.refName,
          start: feat.mate.start,
          end: feat.mate.end,
        },
      ],
      segment,
      inverted: feat.strand === -1,
      attributes: feat.attributes,
      sharedBy,
    }),
    ...(cigarOps.length > 0
      ? [
          `CIGAR operator: ${cigarOps.map(({ op, length }) => `${toLocale(length)}${op}`).join(' ')}`,
        ]
      : []),
  ]
}
