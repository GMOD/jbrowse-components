import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/alignments-core'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { ArcColorByType } from '../../shared/types.ts'

// Arc shape enum. Values are shared with arc.slang (which checks them via
// `> 0.5` / `> 1.5` thresholds); keep in lockstep.
export const ARC_SHAPE_BEZIER = 0
export const ARC_SHAPE_SEMICIRCLE = 1
export const ARC_SHAPE_FLAT = 2
// Split-read flat line (SA tag arcs) — same geometry as FLAT but rendered
// dashed (matching samplot.py's plot_split_plan dotted-line style).
export const ARC_SHAPE_FLAT_SPLIT = 3

// Matches samplot.py --jitter const default (0.08). Applied multiplicatively
// to |tlen| so lines at the same insert size are visually separated.
const SAMPLOT_JITTER_BOUNDS = 0.08

export interface ArcsDataResult {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  // See ARC_SHAPE_* constants.
  arcShapeTypes: Uint8Array
  // Target Y in genomic bp (|tlen| for samplot, |(x2-x1)/2| otherwise)
  arcYBp: Uint32Array
  numArcs: number
  // Max `arcYBp` across `arcShapeTypes === ARC_SHAPE_FLAT` entries. Precomputed
  // so the `arcsYDomainBp` view reduces over regions, not over every arc.
  maxFlatArcYBp: number
  arcLinePositions: Uint32Array
  arcLineYs: Float32Array
  arcLineColorTypes: Uint8Array
  numArcLines: number
  coverageDepths: Float32Array
  coverageMaxDepth: number
  coverageStartPos: number
}

interface RegionInfo {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

interface ArcSettings {
  colorByType: ArcColorByType
  // samplot mode: flat lines at Y=|tlen| with DEL/DUP/INV/BND coloring,
  // and concordant FR pairs filtered out so only discordant pairs remain.
  samplot?: boolean
  drawInter: boolean
  drawLongRange: boolean
}

const ARC_VS_BEZIER_THRESHOLD = 10_000
const VERTICAL_LINE_THRESHOLD = 100_000
const LONG_RANGE_STDDEV_THRESHOLD = 3

// pairOrientationToNum (see shared/buildBaseFeatureData.ts) encodes:
//   0=unknown, 1=LR/normal (F1R2,F2R1), 2=RL (R1F2,R2F1),
//   3=RR (R1R2,R2R1), 4=FF (F1F2,F2F1).
function getOrientationColorIndex(pairOrientationNum: number) {
  switch (pairOrientationNum) {
    case 2:
      return 6
    case 3:
      return 5
    case 4:
      return 4
    default:
      return undefined
  }
}

// A pair is concordant FR (the modal, "normal" insert) when its tlen sits
// inside the insert-size stats band AND it is LR orientation. Samplot drops
// these to surface SV signals (mirrors samplot.py's --max_depth 1 default).
function isConcordantFRPair(
  pairOrientationNum: number | undefined,
  tlen: number | undefined,
  stats: { upper: number; lower: number } | undefined,
) {
  if (pairOrientationNum !== 1 || tlen === undefined || stats === undefined) {
    return false
  }
  const abs = Math.abs(tlen)
  return abs >= stats.lower && abs <= stats.upper
}

// Samplot palette: 0=DEL/normal (black), 1=DUP (red), 2=INV (blue). Matches
// samplotArcColorPalette order. Classification follows samplot.py's
// event_by_strand table: FR→normal/DEL, RF→DUP, FF/RR→INV. Interchrom pairs
// never reach here — they `continue` at the arc loop's p1Ref !== p2Ref guard.
function getSamplotColorIndex(
  pairOrientationNum: number,
  p1Strand: number,
  p2Strand: number,
) {
  if (pairOrientationNum === 2) {
    return 1
  }
  if (pairOrientationNum === 3 || pairOrientationNum === 4) {
    return 2
  }
  if (pairOrientationNum === 1) {
    return 0
  }
  // Strand-only fallback for split reads / SA-tag arcs (no pair orientation).
  // Opposite strand (fwd→rev or rev→fwd) = inversion junction; same = DEL.
  if (p1Strand !== 0 && p2Strand !== 0 && p1Strand !== p2Strand) {
    return 2
  }
  return 0
}

// Color-slot indices into the arc palette. Kept as named constants so the
// classifier reads as a story rather than as magic numbers.
const COLOR_DEFAULT = 0
const COLOR_LONG_INSERT = 1
const COLOR_UNPAIRED_FR = 4
const COLOR_UNPAIRED_RF = 7

function unpairedOrientationColor(p1Strand: number, p2Strand: number) {
  if (p1Strand === -1 && p2Strand === 1) {
    return COLOR_UNPAIRED_RF
  }
  if (p1Strand === 1 && p2Strand === -1) {
    return COLOR_UNPAIRED_FR
  }
  return COLOR_DEFAULT
}

function getArcColorType(args: {
  colorByType: ArcColorByType
  samplot: boolean
  hasPaired: boolean
  longRange: boolean
  drawArcInsteadOfBezier: boolean
  pairOrientationNum: number | undefined
  tlen: number | undefined
  p1Ref: string
  p2Ref: string
  p1Strand: number
  p2Strand: number
  stats: { upper: number; lower: number } | undefined
}) {
  const {
    colorByType,
    samplot,
    hasPaired,
    longRange,
    drawArcInsteadOfBezier,
    pairOrientationNum,
    tlen,
    p1Ref,
    p2Ref,
    p1Strand,
    p2Strand,
    stats,
  } = args

  // Two overrides apply regardless of scheme:
  //   samplot uses its own DEL/DUP/INV palette
  //   long-range arcs (drawn as semicircles) always paint as long-insert
  if (samplot) {
    return getSamplotColorIndex(pairOrientationNum ?? 0, p1Strand, p2Strand)
  }
  if (longRange && drawArcInsteadOfBezier) {
    return COLOR_LONG_INSERT
  }

  // Otherwise dispatch on scheme; each branch decides paired vs unpaired.
  const insertSizeColor = () =>
    getInsertSizeColorIndex(p1Ref, p2Ref, tlen ?? 0, stats) ?? COLOR_DEFAULT

  switch (colorByType) {
    case 'insertSize':
      return hasPaired ? insertSizeColor() : COLOR_DEFAULT

    case 'orientation':
      return hasPaired
        ? (getOrientationColorIndex(pairOrientationNum ?? 0) ?? COLOR_DEFAULT)
        : unpairedOrientationColor(p1Strand, p2Strand)

    case 'insertSizeAndOrientation':
      return hasPaired
        ? (getOrientationColorIndex(pairOrientationNum ?? 0) ??
            insertSizeColor())
        : unpairedOrientationColor(p1Strand, p2Strand)
  }
}

function getInsertSizeColorIndex(
  refName: string,
  nextRef: string | undefined,
  tlen: number,
  stats?: { upper: number; lower: number },
) {
  if (nextRef && refName !== nextRef) {
    return 3
  }
  if (stats) {
    const absTlen = Math.abs(tlen)
    if (absTlen > stats.upper) {
      return 1
    }
    if (absTlen < stats.lower) {
      return 2
    }
  }
  return undefined
}

interface SAAlignment {
  refName: string
  start: number
  end: number
  strand: number
}

interface ArcEndpoint {
  refName: string
  bp: number
}

export interface ComputedArc {
  p1: ArcEndpoint
  p2: ArcEndpoint
  colorType: number
  shapeType: number
  yBp: number
}

export interface ComputedLine {
  x: ArcEndpoint
  colorType: number
}

interface PendingArc {
  p1Ref: string
  p1Bp: number
  p1Strand: number
  p2Ref: string
  p2Bp: number
  p2Strand: number
  pairOrientationNum: number | undefined
  tlen: number | undefined
  isSplit: boolean
}

function parseSATag(sa: string): SAAlignment[] {
  if (!sa) {
    return []
  }
  const result: SAAlignment[] = []
  for (const aln of sa.split(';')) {
    if (!aln) {
      continue
    }
    const parts = aln.split(',')
    // Spec: rname,pos,strand,CIGAR,mapQ,NM — skip anything truncated or with
    // an unparsable position / placeholder CIGAR rather than emitting a
    // junk arc at NaN.
    if (parts.length < 4) {
      continue
    }
    const ref = parts[0]
    const posRaw = parts[1]
    const strandStr = parts[2]
    const cigar = parts[3]
    if (!ref || !cigar || cigar === '*') {
      continue
    }
    const pos = Number(posRaw) - 1
    if (!Number.isFinite(pos) || pos < 0) {
      continue
    }
    const strand = strandStr === '-' ? -1 : 1
    let lengthOnRef = 0
    const re = /(\d+)([MIDNSHP=X])/g
    let m: RegExpExecArray | null
    while ((m = re.exec(cigar)) !== null) {
      const len = +m[1]!
      const op = m[2]!
      if (op === 'M' || op === 'D' || op === 'N' || op === '=' || op === 'X') {
        lengthOnRef += len
      }
    }
    result.push({ refName: ref, start: pos, end: pos + lengthOnRef, strand })
  }
  return result
}

// Deterministic 0..1 hash from arc endpoints — gives each pair a stable jitter
// offset regardless of fetch/render order, so snapshot tests don't flake.
// `Math.sin(x)*43758.5453 mod 1` is the standard GPU-style cheap hash.
function pairJitter01(p1Bp: number, p2Bp: number) {
  const seed = (p1Bp * 374761393 + p2Bp * 668265263) >>> 0
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

// Pick the shape constant and target Y (in genomic bp) for a single arc.
// Samplot: flat line at Y=|tlen| with ±8% multiplicative jitter so coincident
// reads separate visually. Arc mode: semicircle when the span exceeds the
// bezier threshold, otherwise bezier — Y is the genomic radius |x2-x1|/2.
function computeArcShape({
  samplot,
  isSplit,
  longRange,
  drawArcInsteadOfBezier,
  absrad,
  tlen,
  p1Bp,
  p2Bp,
}: {
  samplot: boolean
  isSplit: boolean
  longRange: boolean
  drawArcInsteadOfBezier: boolean
  absrad: number
  tlen: number | undefined
  p1Bp: number
  p2Bp: number
}) {
  if (samplot) {
    const baseY = tlen !== undefined ? Math.abs(tlen) : absrad
    const jitter =
      1 + SAMPLOT_JITTER_BOUNDS * (pairJitter01(p1Bp, p2Bp) * 2 - 1)
    return {
      shapeType: isSplit ? ARC_SHAPE_FLAT_SPLIT : ARC_SHAPE_FLAT,
      yBp: Math.round(baseY * jitter),
    }
  }
  const shapeType =
    longRange && drawArcInsteadOfBezier
      ? ARC_SHAPE_SEMICIRCLE
      : ARC_SHAPE_BEZIER
  return { shapeType, yBp: absrad }
}

function computeLongRangeThreshold(pendingArcs: PendingArc[]) {
  const radii = pendingArcs
    .filter(a => a.p1Ref === a.p2Ref)
    .map(a => Math.abs(a.p2Bp - a.p1Bp) / 2)
  if (radii.length === 0) {
    return Infinity
  }
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length
  const variance = radii.reduce((a, b) => a + (b - mean) ** 2, 0) / radii.length
  const std = Math.sqrt(variance)
  return mean + LONG_RANGE_STDDEV_THRESHOLD * std
}

export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
) {
  const { colorByType, samplot = false, drawInter, drawLongRange } = settings

  const readsByName = new Map<
    string,
    {
      displayedRegionIndex: number
      refName: string
      readIdx: number
      data: PileupDataResult
    }[]
  >()

  for (const region of regions) {
    const data = rpcDataMap.get(region.displayedRegionIndex)
    if (!data) {
      continue
    }
    for (let i = 0; i < data.readIds.length; i++) {
      const name = data.readNames[i]!
      let list = readsByName.get(name)
      if (!list) {
        list = []
        readsByName.set(name, list)
      }
      list.push({
        displayedRegionIndex: region.displayedRegionIndex,
        refName: region.refName,
        readIdx: i,
        data,
      })
    }
  }

  let hasPaired = false
  let stats: { upper: number; lower: number } | undefined
  for (const data of rpcDataMap.values()) {
    if (!hasPaired) {
      for (let i = 0; i < data.readIds.length; i++) {
        if (data.readFlags[i]! & SAM_FLAG_PAIRED) {
          hasPaired = true
          break
        }
      }
    }
    if (!stats && data.insertSizeStats) {
      stats = data.insertSizeStats
    }
  }

  const pendingArcs: PendingArc[] = []

  for (const [, entries] of readsByName) {
    if (entries.length === 1) {
      if (!drawLongRange) {
        continue
      }
      const entry = entries[0]!
      const { data, readIdx, refName } = entry
      const flags = data.readFlags[readIdx]!
      const strand = data.readStrands[readIdx]!
      const start = data.readPositions[readIdx * 2]!
      const end = data.readPositions[readIdx * 2 + 1]!
      const isMateUnmapped = flags & SAM_FLAG_MATE_UNMAPPED

      if (hasPaired && !isMateUnmapped) {
        const mateRef = data.readNextRefs?.[readIdx] ?? ''
        const matePos = data.readNextPositions?.[readIdx] ?? 0
        const mateStrand = flags & SAM_FLAG_MATE_REVERSE ? -1 : 1
        const p1 = strand === -1 ? start : end
        pendingArcs.push({
          p1Ref: refName,
          p1Bp: p1,
          p1Strand: strand,
          p2Ref: mateRef || refName,
          p2Bp: matePos,
          p2Strand: mateStrand,
          pairOrientationNum: data.readPairOrientations[readIdx]!,
          tlen: data.readInsertSizes[readIdx],
          isSplit: false,
        })
      } else {
        const sa = data.readSuppAlignments?.[readIdx] ?? ''
        const saAlns = parseSATag(sa)
        if (saAlns.length > 0) {
          const primary = { refName, start, end, strand }
          const allAlns = [primary, ...saAlns]
          for (let j = 0; j < allAlns.length - 1; j++) {
            const a1 = allAlns[j]!
            const a2 = allAlns[j + 1]!
            // a1.end→a2.start = genomic gap between blocks; fwd→rev and rev→fwd
            // junctions produce narrow arcs clustered at each inversion breakpoint.
            const p1 = a1.end
            const p2 = a2.start
            pendingArcs.push({
              p1Ref: a1.refName,
              p1Bp: p1,
              p1Strand: a1.strand,
              p2Ref: a2.refName,
              p2Bp: p2,
              p2Strand: a2.strand,
              pairOrientationNum: undefined,
              tlen: undefined,
              isSplit: true,
            })
          }
        }
      }
    } else {
      const filtered = hasPaired
        ? entries.filter(
            e =>
              !(e.data.readFlags[e.readIdx]! & SAM_FLAG_SUPPLEMENTARY) &&
              !(e.data.readFlags[e.readIdx]! & SAM_FLAG_MATE_UNMAPPED),
          )
        : entries.filter(
            e => !(e.data.readFlags[e.readIdx]! & SAM_FLAG_SECONDARY),
          )

      for (let j = 0; j < filtered.length - 1; j++) {
        const e1 = filtered[j]!
        const e2 = filtered[j + 1]!
        const f1 = e1.data.readFlags[e1.readIdx]!
        const f2 = e2.data.readFlags[e2.readIdx]!
        const s1 = e1.data.readStrands[e1.readIdx]!
        const s2 = e2.data.readStrands[e2.readIdx]!
        const start1 = e1.data.readPositions[e1.readIdx * 2]!
        const end1 = e1.data.readPositions[e1.readIdx * 2 + 1]!
        const start2 = e2.data.readPositions[e2.readIdx * 2]!
        const end2 = e2.data.readPositions[e2.readIdx * 2 + 1]!
        // A supplementary alignment sharing this read name is a split-read
        // junction, not a mate pair: it carries no template_length or pair
        // orientation. Mark it so samplot renders a dashed line at the gap
        // span — leaving tlen here would feed |0| into the samplot Y and
        // collapse the line to the baseline. Matches the single-entry SA-tag
        // path (which passes tlen/orientation undefined for the same reason).
        const isSplit = !!((f1 | f2) & SAM_FLAG_SUPPLEMENTARY)
        // Unpaired: end1→start2 = genomic gap, giving narrow inversion bp arcs.
        const p1 = hasPaired ? (s1 === -1 ? start1 : end1) : end1
        const p2 = hasPaired ? (s2 === -1 ? start2 : end2) : start2
        pendingArcs.push({
          p1Ref: e1.refName,
          p1Bp: p1,
          p1Strand: s1,
          p2Ref: e2.refName,
          p2Bp: p2,
          p2Strand: s2,
          pairOrientationNum: isSplit
            ? undefined
            : e1.data.readPairOrientations[e1.readIdx],
          tlen: isSplit ? undefined : e1.data.readInsertSizes[e1.readIdx],
          isSplit,
        })
      }
    }
  }

  const longRangeThreshold = computeLongRangeThreshold(pendingArcs)

  const arcs: ComputedArc[] = []
  const lines: ComputedLine[] = []

  for (const {
    p1Ref,
    p1Bp,
    p1Strand,
    p2Ref,
    p2Bp,
    p2Strand,
    pairOrientationNum,
    tlen,
    isSplit,
  } of pendingArcs) {
    // Interchromosomal: never an arc — drop a tick on each endpoint.
    if (p1Ref !== p2Ref) {
      if (drawInter) {
        lines.push(
          { x: { refName: p1Ref, bp: p1Bp }, colorType: 0 },
          { x: { refName: p2Ref, bp: p2Bp }, colorType: 0 },
        )
      }
      continue
    }

    // Samplot suppresses the modal-insert FR pairs so SV signals stand out.
    if (samplot && isConcordantFRPair(pairOrientationNum, tlen, stats)) {
      continue
    }

    const absrad = Math.abs((p2Bp - p1Bp) / 2)
    const longRange = absrad >= longRangeThreshold
    const drawArcInsteadOfBezier = absrad > ARC_VS_BEZIER_THRESHOLD

    // Arc-mode very long-range pairs render as vertical lines rather than
    // tiny bumps. Samplot has no equivalent cap — its flat lines look fine
    // off-band — so the gate is arc-mode-only.
    if (!samplot && longRange && absrad > VERTICAL_LINE_THRESHOLD) {
      if (drawLongRange) {
        lines.push(
          { x: { refName: p1Ref, bp: p1Bp }, colorType: 1 },
          { x: { refName: p1Ref, bp: p2Bp }, colorType: 1 },
        )
      }
      continue
    }

    const colorType = getArcColorType({
      colorByType,
      samplot,
      hasPaired,
      longRange,
      drawArcInsteadOfBezier,
      pairOrientationNum,
      tlen,
      p1Ref,
      p2Ref,
      p1Strand,
      p2Strand,
      stats,
    })
    const { shapeType, yBp } = computeArcShape({
      samplot,
      isSplit,
      longRange,
      drawArcInsteadOfBezier,
      absrad,
      tlen,
      p1Bp,
      p2Bp,
    })

    arcs.push({
      p1: { refName: p1Ref, bp: p1Bp },
      p2: { refName: p2Ref, bp: p2Bp },
      colorType,
      shapeType,
      yBp,
    })
  }

  return { arcs, lines }
}

// Group computed arcs and lines by the refName they belong to so callers
// can look up the per-region subset in O(1) instead of filtering the full
// array once per displayed region.
export function groupArcsByRef(arcs: ComputedArc[], lines: ComputedLine[]) {
  const arcsByRef = new Map<string, ComputedArc[]>()
  for (const arc of arcs) {
    const ref = arc.p1.refName
    let bucket = arcsByRef.get(ref)
    if (!bucket) {
      bucket = []
      arcsByRef.set(ref, bucket)
    }
    bucket.push(arc)
  }
  const linesByRef = new Map<string, ComputedLine[]>()
  for (const line of lines) {
    const ref = line.x.refName
    let bucket = linesByRef.get(ref)
    if (!bucket) {
      bucket = []
      linesByRef.set(ref, bucket)
    }
    bucket.push(line)
  }
  return { arcsByRef, linesByRef }
}

export function arcsToRegionResult(
  regionArcs: ComputedArc[],
  regionLines: ComputedLine[],
  height: number,
): ArcsDataResult {
  const arcX1 = new Uint32Array(regionArcs.length)
  const arcX2 = new Uint32Array(regionArcs.length)
  const arcColorTypes = new Uint8Array(regionArcs.length)
  const arcShapeTypes = new Uint8Array(regionArcs.length)
  const arcYBp = new Uint32Array(regionArcs.length)

  let maxFlatArcYBp = 0
  for (let i = 0; i < regionArcs.length; i++) {
    const arc = regionArcs[i]!
    arcX1[i] = arc.p1.bp
    arcX2[i] = arc.p2.bp
    arcColorTypes[i] = arc.colorType
    arcShapeTypes[i] = arc.shapeType
    arcYBp[i] = arc.yBp
    const isFlat =
      arc.shapeType === ARC_SHAPE_FLAT || arc.shapeType === ARC_SHAPE_FLAT_SPLIT
    if (isFlat && arc.yBp > maxFlatArcYBp) {
      maxFlatArcYBp = arc.yBp
    }
  }

  const arcLinePositions = new Uint32Array(regionLines.length * 2)
  const arcLineYs = new Float32Array(regionLines.length * 2)
  const arcLineColorTypes = new Uint8Array(regionLines.length * 2)

  for (let i = 0; i < regionLines.length; i++) {
    const line = regionLines[i]!
    arcLinePositions[i * 2] = line.x.bp
    arcLinePositions[i * 2 + 1] = line.x.bp
    arcLineYs[i * 2] = 0
    arcLineYs[i * 2 + 1] = height
    arcLineColorTypes[i * 2] = line.colorType
    arcLineColorTypes[i * 2 + 1] = line.colorType
  }

  return {
    arcX1,
    arcX2,
    arcColorTypes,
    arcShapeTypes,
    arcYBp,
    numArcs: regionArcs.length,
    maxFlatArcYBp,
    arcLinePositions,
    arcLineYs,
    arcLineColorTypes,
    numArcLines: regionLines.length,
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
  }
}
