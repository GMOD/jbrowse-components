import {
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from './samFlags.ts'

import type { ArcsDataResult } from '../RenderArcsDataRPC/types.ts'
import type { PileupDataResult } from '../RenderPileupDataRPC/types.ts'

interface RegionInfo {
  refName: string
  start: number
  end: number
  regionNumber: number
}

interface ArcSettings {
  colorByType: string
  drawInter: boolean
  drawLongRange: boolean
}

const ARC_VS_BEZIER_THRESHOLD = 10_000
const VERTICAL_LINE_THRESHOLD = 100_000

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
  isArc: number
}

interface ComputedLine {
  x: ArcEndpoint
  colorType: number
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

export function computeArcsFromPileupData(
  rpcDataMap: Map<number, PileupDataResult>,
  regions: RegionInfo[],
  settings: ArcSettings,
) {
  const { colorByType, drawInter, drawLongRange } = settings

  const readsByName = new Map<
    string,
    {
      regionNumber: number
      refName: string
      readIdx: number
      data: PileupDataResult
    }[]
  >()

  for (const region of regions) {
    const data = rpcDataMap.get(region.regionNumber)
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
        regionNumber: region.regionNumber,
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

  const arcs: ComputedArc[] = []
  const lines: ComputedLine[] = []

  function processArc(
    p1Ref: string,
    p1Bp: number,
    p1Strand: number,
    p2Ref: string,
    p2Bp: number,
    p2Strand: number,
    longRange: boolean,
    pairOrientationNum?: number,
    tlen?: number,
  ) {
    if (p1Ref !== p2Ref) {
      if (drawInter) {
        lines.push({
          x: { refName: p1Ref, bp: p1Bp },
          colorType: 3,
        })
        lines.push({
          x: { refName: p2Ref, bp: p2Bp },
          colorType: 3,
        })
      }
      return
    }

    const radius = (p2Bp - p1Bp) / 2
    const absrad = Math.abs(radius)
    const drawArcInsteadOfBezier = absrad > ARC_VS_BEZIER_THRESHOLD

    let colorType: number
    if (longRange && drawArcInsteadOfBezier) {
      colorType = 1
    } else if (hasPaired) {
      if (
        colorByType === 'insertSizeAndOrientation' ||
        colorByType === 'orientation'
      ) {
        colorType =
          getOrientationColorIndex(pairOrientationNum ?? 0) ??
          (colorByType === 'insertSizeAndOrientation'
            ? (getInsertSizeColorIndex(p1Ref, p2Ref, tlen ?? 0, stats) ?? 0)
            : 0)
      } else if (colorByType === 'insertSize') {
        colorType = getInsertSizeColorIndex(p1Ref, p2Ref, tlen ?? 0, stats) ?? 0
      } else if (colorByType === 'gradient') {
        colorType = 8
      } else {
        colorType = 0
      }
    } else {
      if (
        colorByType === 'orientation' ||
        colorByType === 'insertSizeAndOrientation'
      ) {
        if (p1Strand === -1 && p2Strand === 1) {
          colorType = 7
        } else if (p1Strand === 1 && p2Strand === -1) {
          colorType = 4
        } else {
          colorType = 0
        }
      } else if (colorByType === 'gradient') {
        colorType = 8
      } else {
        colorType = 0
      }
    }

    if (absrad < 1) {
      arcs.push({
        p1: { refName: p1Ref, bp: p1Bp },
        p2: { refName: p1Ref, bp: p2Bp },
        colorType,
        isArc: 0,
      })
    } else if (longRange && absrad > VERTICAL_LINE_THRESHOLD) {
      if (drawLongRange) {
        lines.push({ x: { refName: p1Ref, bp: p1Bp }, colorType: 1 })
        lines.push({ x: { refName: p1Ref, bp: p2Bp }, colorType: 1 })
      }
    } else if (longRange && drawArcInsteadOfBezier) {
      arcs.push({
        p1: { refName: p1Ref, bp: p1Bp },
        p2: { refName: p1Ref, bp: p2Bp },
        colorType,
        isArc: 1,
      })
    } else {
      arcs.push({
        p1: { refName: p1Ref, bp: p1Bp },
        p2: { refName: p1Ref, bp: p2Bp },
        colorType,
        isArc: 0,
      })
    }
  }

  for (const [, entries] of readsByName) {
    if (entries.length === 1) {
      if (!drawLongRange) {
        continue
      }
      const entry = entries[0]!
      const { data, readIdx, refName } = entry
      const flags = data.readFlags[readIdx]!
      const strand = data.readStrands[readIdx]!
      const start =
        data.regionStart + data.readPositions[readIdx * 2]!
      const end =
        data.regionStart + data.readPositions[readIdx * 2 + 1]!
      const isMateUnmapped = flags & SAM_FLAG_MATE_UNMAPPED

      if (hasPaired && !isMateUnmapped) {
        const mateRef = data.readNextRefs?.[readIdx] ?? ''
        const matePos = data.readNextPositions?.[readIdx] ?? 0
        const mateStrand = flags & SAM_FLAG_MATE_REVERSE ? -1 : 1
        const p1 = strand === -1 ? start : end
        const p2 = matePos
        const pairOrientationNum = data.readPairOrientations[readIdx]!
        processArc(
          refName,
          p1,
          strand,
          mateRef || refName,
          p2,
          mateStrand,
          true,
          pairOrientationNum,
          data.readInsertSizes[readIdx],
        )
      } else {
        const sa = data.readSuppAlignments?.[readIdx] ?? ''
        const saAlns = parseSATag(sa)
        if (saAlns.length > 0) {
          const primary = {
            refName,
            start,
            end,
            strand,
          }
          const allAlns = [primary, ...saAlns]
          for (let j = 0; j < allAlns.length - 1; j++) {
            const a1 = allAlns[j]!
            const a2 = allAlns[j + 1]!
            const p1 = a1.strand === -1 ? a1.start : a1.end
            const p2 = a2.strand === -1 ? a2.end : a2.start
            processArc(
              a1.refName,
              p1,
              a1.strand,
              a2.refName,
              p2,
              a2.strand,
              true,
            )
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
        const start1 =
          e1.data.regionStart + e1.data.readPositions[e1.readIdx * 2]!
        const end1 =
          e1.data.regionStart + e1.data.readPositions[e1.readIdx * 2 + 1]!
        const start2 =
          e2.data.regionStart + e2.data.readPositions[e2.readIdx * 2]!
        const end2 =
          e2.data.regionStart + e2.data.readPositions[e2.readIdx * 2 + 1]!

        const p1 = s1 === -1 ? start1 : end1
        const p2 = hasPaired ? (s2 === -1 ? start2 : end2) : (s2 === -1 ? end2 : start2)

        processArc(
          e1.refName,
          p1,
          s1,
          e2.refName,
          p2,
          s2,
          false,
        )
      }
    }
  }

  return { arcs, lines }
}

export function arcsToRegionResult(
  arcs: ComputedArc[],
  lines: ComputedLine[],
  regionRefName: string,
  regionStart: number,
  height: number,
): ArcsDataResult {
  const regionArcs = arcs.filter(
    a => a.p1.refName === regionRefName && a.p2.refName === regionRefName,
  )
  const arcX1 = new Float32Array(regionArcs.length)
  const arcX2 = new Float32Array(regionArcs.length)
  const arcColorTypes = new Float32Array(regionArcs.length)
  const arcIsArc = new Uint8Array(regionArcs.length)

  for (const [i, arc] of regionArcs.entries()) {
    arcX1[i] = arc.p1.bp - regionStart
    arcX2[i] = arc.p2.bp - regionStart
    arcColorTypes[i] = arc.colorType
    arcIsArc[i] = arc.isArc
  }

  const regionLines = lines.filter(l => l.x.refName === regionRefName)
  const linePositions = new Uint32Array(regionLines.length * 2)
  const lineYs = new Float32Array(regionLines.length * 2)
  const lineColorTypes = new Float32Array(regionLines.length * 2)

  for (const [i, line] of regionLines.entries()) {
    const xOffset = line.x.bp - regionStart
    linePositions[i * 2] = xOffset
    linePositions[i * 2 + 1] = xOffset
    lineYs[i * 2] = 0
    lineYs[i * 2 + 1] = height
    lineColorTypes[i * 2] = line.colorType
    lineColorTypes[i * 2 + 1] = line.colorType
  }

  return {
    regionStart,
    arcX1,
    arcX2,
    arcColorTypes,
    arcIsArc,
    numArcs: regionArcs.length,
    linePositions,
    lineYs,
    lineColorTypes,
    numLines: regionLines.length,
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartOffset: 0,
  }
}
