import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from './samFlags.ts'

import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'

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
  linePositions: Uint32Array
  lineYs: Float32Array
  lineColorTypes: Uint8Array
  numLines: number
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
  colorByType: string
  drawInter: boolean
  drawLongRange: boolean
}

const ARC_VS_BEZIER_THRESHOLD = 10_000
const VERTICAL_LINE_THRESHOLD = 100_000
const LONG_RANGE_STDDEV_THRESHOLD = 3

// pairOrientationToNum encodes: 0=unknown, 1=LR(normal), 2=RL, 3=RR/FF, 4=LL/RR
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
  // Same-strand → INV; opposite strand → DEL (normal FR shape); unknown → DEL.
  if (p1Strand !== 0 && p2Strand !== 0 && p1Strand === p2Strand) {
    return 2
  }
  return 0
}

// Color-slot indices into the arc palette. Kept as named constants so the
// classifier reads as a story rather than as magic numbers.
const COLOR_DEFAULT = 0
const COLOR_LONG_INSERT = 1
const COLOR_GRADIENT = 8
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
  colorByType: string
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
  if (colorByType === 'samplot') {
    return getSamplotColorIndex(pairOrientationNum ?? 0, p1Strand, p2Strand)
  }
  if (longRange && drawArcInsteadOfBezier) {
    return COLOR_LONG_INSERT
  }

  // Otherwise dispatch on scheme; each branch decides paired vs unpaired.
  const insertSizeColor = () =>
    getInsertSizeColorIndex(p1Ref, p2Ref, tlen ?? 0, stats) ?? COLOR_DEFAULT

  switch (colorByType) {
    case 'gradient':
      return COLOR_GRADIENT

    case 'insertSize':
      return hasPaired ? insertSizeColor() : COLOR_DEFAULT

    case 'orientation':
      return hasPaired
        ? (getOrientationColorIndex(pairOrientationNum ?? 0) ?? COLOR_DEFAULT)
        : unpairedOrientationColor(p1Strand, p2Strand)

    case 'insertSizeAndOrientation':
      return hasPaired
        ? (getOrientationColorIndex(pairOrientationNum ?? 0) ?? insertSizeColor())
        : unpairedOrientationColor(p1Strand, p2Strand)

    default:
      return COLOR_DEFAULT
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

interface ComputedArc {
  p1: ArcEndpoint
  p2: ArcEndpoint
  colorType: number
  shapeType: number
  yBp: number
}

interface ComputedLine {
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
    const ref = parts[0]!
    const pos = +parts[1]! - 1
    const strand = parts[2] === '-' ? -1 : 1
    const cigar = parts[3]!
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
  const threshold = mean + LONG_RANGE_STDDEV_THRESHOLD * std
  return threshold
}

export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
) {
  const { colorByType, drawInter, drawLongRange } = settings
  const samplot = colorByType === 'samplot'

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
    for (let i = 0; i < data.numReads; i++) {
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
      for (let i = 0; i < data.numReads; i++) {
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
            const p1 = a1.strand === -1 ? a1.start : a1.end
            const p2 = a2.strand === -1 ? a2.end : a2.start
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
        const s1 = e1.data.readStrands[e1.readIdx]!
        const s2 = e2.data.readStrands[e2.readIdx]!
        const start1 = e1.data.readPositions[e1.readIdx * 2]!
        const end1 = e1.data.readPositions[e1.readIdx * 2 + 1]!
        const start2 = e2.data.readPositions[e2.readIdx * 2]!
        const end2 = e2.data.readPositions[e2.readIdx * 2 + 1]!
        const p1 = s1 === -1 ? start1 : end1
        const p2 = hasPaired
          ? s2 === -1
            ? start2
            : end2
          : s2 === -1
            ? end2
            : start2
        pendingArcs.push({
          p1Ref: e1.refName,
          p1Bp: p1,
          p1Strand: s1,
          p2Ref: e2.refName,
          p2Bp: p2,
          p2Strand: s2,
          pairOrientationNum: e1.data.readPairOrientations[e1.readIdx],
          tlen: e1.data.readInsertSizes[e1.readIdx],
          isSplit: false,
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
    if (p1Ref !== p2Ref) {
      if (drawInter) {
        lines.push(
          { x: { refName: p1Ref, bp: p1Bp }, colorType: 0 },
          { x: { refName: p2Ref, bp: p2Bp }, colorType: 0 },
        )
      }
      continue
    }

    const radius = (p2Bp - p1Bp) / 2
    const absrad = Math.abs(radius)
    const longRange = absrad >= longRangeThreshold
    const drawArcInsteadOfBezier = absrad > ARC_VS_BEZIER_THRESHOLD

    // console.log('processArc', { p1Ref, p1Bp, p2Ref, p2Bp, longRange, absrad, longRangeThreshold, drawArcInsteadOfBezier, pairOrientationNum, tlen, hasPaired, colorByType })

    const colorType = getArcColorType({
      colorByType,
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

    // Samplot skips the vertical-line threshold — flat lines above the
    // arcs band cap look correct for long-range pairs and samplot.py has no
    // equivalent cutoff.
    if (!samplot && longRange && absrad > VERTICAL_LINE_THRESHOLD) {
      if (drawLongRange) {
        lines.push(
          { x: { refName: p1Ref, bp: p1Bp }, colorType: 1 },
          { x: { refName: p1Ref, bp: p2Bp }, colorType: 1 },
        )
      }
      continue
    }

    let shapeType: number
    if (samplot) {
      shapeType = isSplit ? ARC_SHAPE_FLAT_SPLIT : ARC_SHAPE_FLAT
    } else if (longRange && drawArcInsteadOfBezier) {
      shapeType = ARC_SHAPE_SEMICIRCLE
    } else {
      shapeType = ARC_SHAPE_BEZIER
    }
    const rawYBp = samplot && tlen !== undefined ? Math.abs(tlen) : absrad
    const yBp = samplot
      ? Math.round(rawYBp * (1 + SAMPLOT_JITTER_BOUNDS * (Math.random() * 2 - 1)))
      : rawYBp

    arcs.push({
      p1: { refName: p1Ref, bp: p1Bp },
      p2: { refName: p1Ref, bp: p2Bp },
      colorType,
      shapeType,
      yBp,
    })
  }

  return { arcs, lines }
}

export function arcsToRegionResult(
  arcs: ComputedArc[],
  lines: ComputedLine[],
  regionRefName: string,
  height: number,
): ArcsDataResult {
  const regionArcs = arcs.filter(
    a => a.p1.refName === regionRefName && a.p2.refName === regionRefName,
  )
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

  const regionLines = lines.filter(l => l.x.refName === regionRefName)
  const linePositions = new Uint32Array(regionLines.length * 2)
  const lineYs = new Float32Array(regionLines.length * 2)
  const lineColorTypes = new Uint8Array(regionLines.length * 2)

  for (let i = 0; i < regionLines.length; i++) {
    const line = regionLines[i]!
    linePositions[i * 2] = line.x.bp
    linePositions[i * 2 + 1] = line.x.bp
    lineYs[i * 2] = 0
    lineYs[i * 2 + 1] = height
    lineColorTypes[i * 2] = line.colorType
    lineColorTypes[i * 2 + 1] = line.colorType
  }

  return {
    arcX1,
    arcX2,
    arcColorTypes,
    arcShapeTypes,
    arcYBp,
    numArcs: regionArcs.length,
    maxFlatArcYBp,
    linePositions,
    lineYs,
    lineColorTypes,
    numLines: regionLines.length,
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
  }
}
