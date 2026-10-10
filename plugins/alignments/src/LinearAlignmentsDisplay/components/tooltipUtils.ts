import {
  formatInsertionLabel,
  formatLocationRange,
  readNameAt,
} from '@jbrowse/alignments-core'
import {
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { toLocale } from '@jbrowse/core/util'
import { escapeHTML } from '@jbrowse/core/util/htmlText'
import { hiddenSegmentsNote } from '@jbrowse/sv-core'

import {
  ARC_SHAPE_FLAT,
  isUnplacedArcShape,
} from '../../features/arcs/shapes.ts'
import { spliceMotifLabel } from '../../features/sashimi/motif.ts'
import { classifyInsertSize } from '../../shared/insertSizeStats.ts'
import { nextRefAt } from '../../shared/readNextRefs.ts'
import { getCigarTypeLabel } from '../../shared/types.ts'
import { MAPQ_UNAVAILABLE } from '../../shared/util.ts'
import { READ_COLOR_CATEGORY_BY_INDEX } from '../colorUtils.ts'
import { getCoverageBin, getInterbaseBin } from './positionStats.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types'
import type { PartnerLocus } from '../../features/arcs/arcTypes.ts'
import type { ArcHit, TickHit } from '../../features/arcs/bandFeed.ts'
import type { ConnectorHit } from '../../features/linkedReads/connectorFeed.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ReadColorCategory } from '../colorUtils.ts'
import type { CoverageBin, InterbaseBin } from './positionStats.ts'

export interface IndicatorTooltipPayload {
  type: 'indicator'
  bin: InterbaseBin
  refName: string
}

export interface CoverageTooltipPayload {
  type: 'coverage'
  bin: CoverageBin
  refName: string
}

export interface ModificationTooltipPayload extends ModificationHitResult {
  type: 'modification'
  refName: string
  snpBase?: string
}

export interface SashimiTooltipPayload {
  type: 'sashimi'
  start: number
  end: number
  score: number
  strand: string
  refName: string
  // 'GT-AG (canonical)' / 'GC-AG (canonical)' / 'AT-AC (canonical)' /
  // 'non-canonical'; absent when neither end was ever read off the reference
  motif?: string
}

export interface ArcTooltipPayload {
  type: 'arc'
  refName: string
  // The two endpoints in absolute genomic bp, ordered left-to-right — UNLESS
  // `endRefName` is set, where they are `refName`'s end and `endRefName`'s end
  // in that order and ordering them would be meaningless.
  start: number
  end: number
  // The far end's chromosome, present only when it differs from `refName`. An
  // interchromosomal arc is the one mark whose two feet are not on one number
  // line, so it is rendered as two positions rather than as a range with a
  // distance: `chr22:23,290,313-130,853,964` names one chromosome and a
  // coordinate from another, and a bp distance across a translocation is not a
  // quantity. As a tick this fact was readable from the mark itself; as an arc
  // the color is the only channel carrying it, so the hover has to say it.
  endRefName?: string
  // Reads behind this arc. One arc is one junction since `resolveArcs`, so this
  // is the number the stroke width encodes — and the reason the hover is worth
  // having: the picture ranks junctions, and this says by how much.
  support: number
  // The color bucket's own wording, so the tooltip names what the color already
  // says. Undefined for a bucket with no single swatch.
  category: string | undefined
  // |tlen| for a read-cloud flat line, which is the quantity its Y encodes.
  // Absent for a curved arc, whose Y is derived from the endpoints and would
  // just restate the span.
  insertSize?: number
  // How far away the partner is, for a read-cloud mark whose partner is outside
  // every loaded region. Present INSTEAD of the location range, which such a
  // mark cannot answer: its two feet are collapsed onto the one end the view can
  // place, so `start` and `end` are that single coordinate and a range between
  // them is zero wide. See `ARC_SHAPE_FLAT_UNPLACED`.
  unplacedPartnerBp?: number
}

// An interchromosomal connector tick. Its own payload rather than an
// `ArcTooltipPayload` with optional halves: a tick has ONE endpoint, no span, no
// insert size and no color bucket (every tick is ARC_COLOR_INTERCHROM), and
// what it does have — the chromosomes on the far side — no arc has.
export interface ArcLineTooltipPayload {
  type: 'arcLine'
  refName: string
  // The breakpoint itself, in absolute genomic bp.
  position: number
  // The chromosome(s) the reads through this breakpoint have their mates on,
  // sorted. Never empty. More than one is a genuinely complex rearrangement
  // rather than a formatting edge case, so the tooltip lists them all.
  partnerRefNames: string[]
  // Where the reads land, most first — the window a reader would add next.
  partnerLoci: PartnerLocus[]
  // Reads behind the tick, which is what its stroke width encodes.
  support: number
  // Whether the far end of every connection under this tick is somewhere the
  // view cannot show. True in arc mode and only there, which is a property of
  // the feed rather than a hedge: `resolveArcs` sends a connection with both
  // feet in displayed regions to the cross-region ARC, so a tick that survives
  // `lineTouchesRegion` can only have been pushed for a partner that resolved
  // to no region. Read cloud is the exception — it ticks every
  // interchromosomal connection, displayed partner or not, because the cloud's
  // Y axis is insert size and a translocation has none.
  //
  // The hover needs it because naming the mate chromosome is not enough when
  // that chromosome is ON SCREEN with arcs into it: the reader looks across,
  // finds the partner window, and has no way to learn that these particular
  // reads land outside it.
  partnerOffView: boolean
}

// "Supported by 1 read" / "Supported by 12 reads". Singular at 1 so a lone
// connection does not read as a suspiciously weak junction.
export function readCount(support: number) {
  return support === 1 ? '1 read' : `${toLocale(support)} reads`
}

export function supportLabel(support: number) {
  return `Supported by ${readCount(support)}`
}

// HTML/plain strings come from formatReadTooltip / formatCigarTooltip;
// structured payloads come from the other formatters. The consumer dispatches on
// typeof + .type.
export type TooltipPayload =
  | string
  | IndicatorTooltipPayload
  | CoverageTooltipPayload
  | ModificationTooltipPayload
  | SashimiTooltipPayload
  | ArcTooltipPayload
  | ArcLineTooltipPayload

const PAIR_ORIENTATION_NAMES = ['', 'LR', 'RL', 'RR', 'LL'] as const

// Only the abnormal orientations get a line of their own — LR (1) is the normal
// pair and 0 is "unknown", neither of which is worth reporting. Indexed by the
// same pairOrientationToNum encoding as PAIR_ORIENTATION_NAMES, so a lookup miss
// IS the "nothing to say" answer and no separate `> 1` guard is needed.
const ABNORMAL_ORIENTATION_DESCRIPTIONS: Record<number, string> = {
  2: 'Outward facing pair',
  3: 'Both mates reverse strand',
  4: 'Both mates forward strand',
}

// Human-readable pair anomalies for the tooltip. An unmapped mate or an
// inter-chromosomal mate makes insert size / orientation meaningless (matching
// the dedicated color buckets), so those pre-empt everything. Otherwise a
// same-chromosome pair can be BOTH abnormally oriented AND have an anomalous
// insert size, so both lines are reported — unlike the single fill color, which
// must pick one. Insert size flows through the shared classifyInsertSize (its
// unset-TLEN guard included) so it can't drift from the coloring thresholds.
//
// `interchrom` is the worker's per-read flag (buildReadInterchrom), NOT a
// refName comparison done here. RNEXT carries the BAM header's own naming
// (`chr1`) while a main-thread refName is assembly-canonical (`1`), so comparing
// them here reported every paired read on an aliased BAM as inter-chromosomal —
// and, being pre-emptive, swallowed its real orientation/insert-size lines. The
// worker does the same comparison with both names in file space, which is where
// the read fill gets it right, so reuse that verdict rather than re-deriving it.
function getPairTypeDescriptions({
  flags,
  pairOrientation,
  insertSize,
  interchrom,
  insertSizeStats,
  nextRef,
}: {
  flags: number
  pairOrientation: number
  insertSize: number
  interchrom: number
  insertSizeStats?: InsertSizeBand
  nextRef: string
}): string[] {
  if (flags & SAM_FLAG_MATE_UNMAPPED) {
    return ['Unmapped mate']
  }
  if (interchrom === 1) {
    return [
      nextRef
        ? `Inter-chromosomal (mate on ${nextRef})`
        : 'Inter-chromosomal mate',
    ]
  }
  const out: string[] = []
  const orient = ABNORMAL_ORIENTATION_DESCRIPTIONS[pairOrientation]
  if (orient) {
    out.push(orient)
  }
  const insertClass = classifyInsertSize(insertSize, insertSizeStats)
  if (insertClass === 'long') {
    out.push('Long insert size')
  } else if (insertClass === 'short') {
    out.push('Short insert size')
  }
  return out
}

// The span the chain covers in THIS region, from the chain arrays rather than
// from the read at `idx`. `hitTestChain` answers a hover with the chain's FIRST
// read, so a cursor on the connecting line between two mates was told mate 1's
// coordinates under a heading naming the whole template — and the connecting
// line is a thing users hover on purpose now that chain mode draws one across
// displayed regions too. Falls back to the read's own span for a hover that
// resolved no chain (an ordinary read, or data with no chain metadata).
function chainSpan(rpcData: PileupDataResult, idx: number) {
  const chainIdx = rpcData.readChainIndices?.[idx]
  const start =
    chainIdx === undefined ? undefined : rpcData.chainAbsMinStarts?.[chainIdx]
  const end =
    chainIdx === undefined ? undefined : rpcData.chainAbsMaxEnds?.[chainIdx]
  return start !== undefined && end !== undefined
    ? { start, end }
    : {
        start: rpcData.readPositions[idx * 2] ?? 0,
        end: rpcData.readPositions[idx * 2 + 1] ?? 0,
      }
}

/**
 * The pileup hover, in every mode, and the one place that names a read's COLOR.
 *
 * One formatter for both modes: `chainSpan` is the chain's extent where there is
 * a chain and the read's own where there isn't, every other row reads a field
 * the worker fills either way, and a row with nothing to say appends nothing.
 *
 * Chain mode is the only mode where the fill cannot be derived from the read's
 * own record: `consensusChainStrandFrames` settles which way "same strand"
 * points from the OTHER chains on screen, so a reverse-mapped segment can
 * legitimately be painted "same strand" and a reader looking at the record has
 * no way to get there. `(-)` and "Split segment (same strand)" both being true
 * is the confusing case, and naming the bucket is what connects the color to the
 * legend row that explains it.
 *
 * `categoryLabel` arrives already carrying the scheme's rewording (the model's
 * `readCategoryLabel`), so this line and the swatch cannot disagree. Undefined
 * for the buckets with no single name — the mapq/tag/modification ramps, and an
 * ordinary unbucketed read — which append nothing rather than a blank row.
 */
export function formatReadTooltip(
  rpcData: PileupDataResult,
  idx: number,
  refName: string,
  categoryLabel?: (c: ReadColorCategory) => string | undefined,
) {
  const name = readNameAt(rpcData, idx)
  const { start, end } = chainSpan(rpcData, idx)
  const flags = rpcData.readFlags[idx] ?? 0
  const insertSize = rpcData.readInsertSizes[idx] ?? 0
  const pairOrientation = rpcData.readPairOrientations[idx] ?? 0
  const mapq = rpcData.readMapqs[idx]

  const lines = [
    `<b>${escapeHTML(name)}</b>`,
    `${formatLocationRange(refName, start, end)} (${rpcData.readStrands[idx] === -1 ? '-' : '+'})`,
  ]

  if (mapq !== undefined) {
    // 255 is the SAM spec's "not available", which the color scheme, the legend
    // and the group-by dimension all name rather than plot — so the row says it
    // too instead of reporting the sentinel as a very good alignment.
    lines.push(mapq === MAPQ_UNAVAILABLE ? 'MAPQ unavailable' : `MAPQ: ${mapq}`)
  }

  // readInsertSizes is |TLEN| already (buildBaseFeatureData abs's it).
  if (insertSize !== 0) {
    lines.push(`Template length: ${toLocale(insertSize)}`)
  }

  const orientName = PAIR_ORIENTATION_NAMES[pairOrientation]
  if (orientName) {
    lines.push(`Pair orientation: ${orientName}`)
  }

  lines.push(
    ...getPairTypeDescriptions({
      flags,
      pairOrientation,
      insertSize,
      interchrom: rpcData.readInterchrom[idx] ?? 0,
      insertSizeStats: rpcData.insertSizeStats,
      nextRef: nextRefAt(rpcData, idx),
    }),
  )

  if (flags & SAM_FLAG_SUPPLEMENTARY) {
    lines.push('Supplementary alignment')
  }

  // `readColorCategories` is EMPTY until the main thread bakes it — the worker
  // ships it that way — so this is a real absence on a hover that beats the
  // bake, not a defensive `?.`. Both halves resolve to "say nothing" rather than
  // to a `Color: undefined` row.
  const bucket =
    READ_COLOR_CATEGORY_BY_INDEX[rpcData.readColorCategories[idx] ?? -1]
  const category = bucket && categoryLabel?.(bucket)
  if (category) {
    lines.push(`Color: ${category}`)
  }

  return lines.join('<br>')
}

export function formatCigarTooltip(cigarHit: CigarHitResult) {
  const pos = toLocale(cigarHit.position + 1)
  switch (cigarHit.type) {
    case 'mismatch': {
      // Absent = the read reported no base quality; omit the parenthetical
      // rather than invent one. Q0 is a score and prints, which is the point of
      // resolving the sentinel in `hitTestMismatch` rather than here: the worst
      // possible call is worth showing, and truthiness could not tell the two
      // apart.
      const qual = cigarHit.qual === undefined ? '' : ` (Q${cigarHit.qual})`
      return `SNP: ${cigarHit.base} at ${pos}${qual}`
    }
    case 'insertion':
      return `${formatInsertionLabel(cigarHit.length, cigarHit.sequence)} at ${pos}`
    // deletion / skip / softclip / hardclip all read "<label> (Nbp) at pos", and
    // the label comes from the shared vocabulary so the hover, the widget title,
    // and the context menu can't spell the same op three ways.
    default:
      return `${getCigarTypeLabel(cigarHit.type)} (${cigarHit.length}bp) at ${pos}`
  }
}

export function formatIndicatorTooltip(
  position: number,
  blockRpcData: PileupDataResult,
  refName: string,
): IndicatorTooltipPayload | undefined {
  const bin = getInterbaseBin(position, blockRpcData)
  return bin ? { type: 'indicator', bin, refName } : undefined
}

export function formatCoverageTooltip(
  position: number,
  blockRpcData: PileupDataResult,
  refName: string,
): CoverageTooltipPayload | undefined {
  const bin = getCoverageBin(position, blockRpcData)
  return bin ? { type: 'coverage', bin, refName } : undefined
}

export function formatModificationTooltip(
  hit: ModificationHitResult,
  refName: string,
  snpBase?: string,
): ModificationTooltipPayload {
  return { type: 'modification', ...hit, refName, snpBase }
}

// The hover of a junction the sashimi marks' hit test found
// (`resolveSashimiHover`).
export function formatSashimiTooltip(junction: {
  start: number
  end: number
  count: number
  strand: number
  refName: string
  motif: number
}): SashimiTooltipPayload {
  const { start, end, count, strand, refName, motif } = junction
  return {
    type: 'sashimi',
    start,
    end,
    score: count,
    strand: strand === 1 ? '+' : strand === -1 ? '-' : 'unknown',
    refName,
    motif: spliceMotifLabel(motif),
  }
}

// The hover of a connection the band's hit test found (`resolveArcBandHover`).
//
// The endpoints are ordered here rather than at the hit test, which reports them
// as the worker resolved them (mate 1, mate 2). A location range reads
// backwards otherwise, and the arc itself is symmetric — `arcKey` already
// treats the pair as ordered, so nothing downstream distinguishes them.
//
// UNLESS the two ends are on different chromosomes, where ordering them is
// meaningless and `min`/`max` over the two bp is a locstring naming one
// chromosome and a coordinate from another. `endRefName` is what separates the
// two cases: absent or equal, this is a range; different, it is two positions,
// and the partner chromosome is exactly what a tick's hover was worth more than
// an arc's before the arc could be drawn at all.
export function formatArcTooltip(
  hit: Pick<ArcHit, 'x1' | 'x2' | 'support' | 'shapeType' | 'spanBp'>,
  refName: string,
  category: string | undefined,
  endRefName?: string,
): ArcTooltipPayload {
  if (endRefName !== undefined && endRefName !== refName) {
    return {
      type: 'arc',
      refName,
      // NOT ordered: `x1` belongs to `refName` and `x2` to `endRefName`, and
      // swapping them would put each coordinate under the other's chromosome.
      start: hit.x1,
      end: hit.x2,
      endRefName,
      support: hit.support,
      category,
    }
  }
  // The partner is off screen, so there is no range and no distance to print
  // between two coordinates — only where this end is and how far away the other
  // one was reported to be.
  if (isUnplacedArcShape(hit.shapeType)) {
    return {
      type: 'arc',
      refName,
      start: hit.x1,
      end: hit.x1,
      support: hit.support,
      category,
      unplacedPartnerBp: hit.spanBp,
    }
  }
  return {
    type: 'arc',
    refName,
    start: Math.min(hit.x1, hit.x2),
    end: Math.max(hit.x1, hit.x2),
    support: hit.support,
    category,
    // ARC_SHAPE_FLAT alone — the read cloud's placed MATE LINK, the one shape
    // whose `spanBp` is a template length. Deliberately not `isFlatArcShape`,
    // which is the right predicate for "does this draw as a bar" and the wrong
    // one for "does this have an insert size": it also admits
    // ARC_SHAPE_FLAT_SPLIT, and a split junction has no TLEN at all.
    // `computeArcShape` gives that arm `spanBp = |p2Bp - p1Bp|`, which is
    // exactly `end - start` above, so the row was the Distance line over again
    // under a name the read cannot support. The unplaced shape is handled
    // above, where the same number is the distance to a partner rather than a
    // template length a molecule had.
    //
    // A curve is excluded for the milder reason: its Y is the genomic radius,
    // half the span already shown.
    //
    // `spanBp`, NOT the `yBp` it draws at: the read cloud scales a line's Y by
    // a ±8% jitter so coincident pairs don't stack, and reading the drawn
    // position back reported that jittered number as the template length. The
    // hit no longer carries the drawn position at all.
    ...(hit.shapeType === ARC_SHAPE_FLAT ? { insertSize: hit.spanBp } : {}),
  }
}

// A connector tick's hover. `refName` is the region the tick is drawn in —
// which the hit result cannot carry, since the feed is bucketed by refName and
// each region's array holds only its own.
export function formatArcLineTooltip(
  hit: TickHit,
  refName: string,
  partnerOffView: boolean,
): ArcLineTooltipPayload {
  return {
    type: 'arcLine',
    refName,
    position: hit.bp,
    partnerRefNames: hit.partnerRefNames,
    partnerLoci: hit.partnerLoci,
    support: hit.support,
    partnerOffView,
  }
}

/**
 * A connector's hover: what kind of connection it is and the two reads it
 * joins, and for a junction across unfetched segments the loci it stepped
 * through, the one place those are named.
 */
export function formatConnectorTooltip(
  hit: Pick<ConnectorHit, 'label' | 'id1' | 'id2' | 'hiddenSegmentsBetween'>,
  infoOf: (id: string) => TooltipFeatureInfo | undefined,
) {
  const parts: string[] = []
  for (const id of [hit.id1, hit.id2]) {
    const info = infoOf(id)
    if (info) {
      parts.push(formatFeatureLabel(info))
    }
  }
  const connection =
    parts.length > 0 ? `${hit.label}: ${parts.join(' → ')}` : hit.label
  return hit.hiddenSegmentsBetween?.length
    ? `${connection}<br/>${hiddenSegmentsNote(hit.hiddenSegmentsBetween)}`
    : connection
}

export interface TooltipFeatureInfo {
  id: string
  name: string
  start: number
  end: number
  strand: number
  refName: string
}

// "name chr1:1,001-1,100" for one read, for the bezier overlay's two-endpoint
// tooltip. No strand: the curve's own color already encodes orientation.
export function formatFeatureLabel(info: TooltipFeatureInfo) {
  return `${escapeHTML(info.name || info.id)} ${formatLocationRange(info.refName, info.start, info.end)}`
}
