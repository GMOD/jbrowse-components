import type { TranscriptCoords } from '../RenderFeatureDataRPC/rpcTypes.ts'

interface ExonicPosition {
  index: number
  // 0 when exonic; otherwise the signed intron offset, positive from the end
  // of exon `index`, negative back from its start.
  offset: number
  exonNumber: number
  exonCount: number
}

// One record so the exon number and the coordinate come from one walk and
// cannot disagree.
interface TranscriptPosition extends ExonicPosition {
  hgvs?: string
}

interface AxisExon {
  first: number
  last: number
}

// Negating the genomic coordinate on the - strand makes the axis 5'→3' for
// both strands, so every walk is written once.
function transcriptionAxis({ exons, strand }: TranscriptCoords) {
  const reverse = strand === -1
  const out: AxisExon[] = []
  for (let i = 0; i < exons.length; i += 2) {
    const start = exons[i]!
    const end = exons[i + 1]!
    out.push(
      reverse
        ? { first: -(end - 1), last: -start }
        : { first: start, last: end - 1 },
    )
  }
  return out
}

function toAxis(coords: TranscriptCoords, bpPos: number) {
  return coords.strand === -1 ? -bpPos : bpPos
}

// An intronic position is measured from the nearer flanking exon, a tie going
// to the 5' exon, per HGVS.
function locateOnAxis(axis: AxisExon[], pos: number) {
  const exonCount = axis.length
  let transcribedBefore = 0
  for (const [i, exon] of axis.entries()) {
    const length = exon.last - exon.first + 1
    if (pos >= exon.first && pos <= exon.last) {
      return {
        index: transcribedBefore + (pos - exon.first),
        offset: 0,
        exonNumber: i + 1,
        exonCount,
      }
    }
    const next = axis[i + 1]
    if (next && pos > exon.last && pos < next.first) {
      const fromPrev = pos - exon.last
      const toNext = next.first - pos
      return fromPrev <= toNext
        ? {
            index: transcribedBefore + length - 1,
            offset: fromPrev,
            exonNumber: i + 1,
            exonCount,
          }
        : {
            index: transcribedBefore + length,
            offset: -toNext,
            exonNumber: i + 2,
            exonCount,
          }
    }
    transcribedBefore += length
  }
  return undefined
}

// Undefined when the coding bounds do not land in an exon: c.1 is the A of a
// start codon, and an untranscribed start codon cannot anchor a count.
function codingIndexRange(
  coords: TranscriptCoords,
  axis: AxisExon[],
  [low, high]: [number, number],
) {
  const reverse = coords.strand === -1
  const first = locateOnAxis(axis, toAxis(coords, reverse ? high - 1 : low))
  const last = locateOnAxis(axis, toAxis(coords, reverse ? low : high - 1))
  return first?.offset === 0 && last?.offset === 0
    ? ([first.index, last.index] as const)
    : undefined
}

function offsetSuffix(offset: number) {
  return offset === 0 ? '' : offset > 0 ? `+${offset}` : `${offset}`
}

// Nothing for a transcript that codes but whose coding extent cannot be
// placed: `n.` is a claim that the transcript is non-coding, in the exact
// syntax variants are reported in.
function hgvsCoordinate(
  coords: TranscriptCoords,
  axis: AxisExon[],
  { index, offset }: ExonicPosition,
) {
  const suffix = offsetSuffix(offset)
  const { coding } = coords
  if (!coding) {
    return `n.${index + 1}${suffix}`
  }
  const range = codingIndexRange(coords, axis, coding)
  if (!range) {
    return undefined
  }
  const [firstCoding, lastCoding] = range
  return index < firstCoding
    ? `c.${index - firstCoding}${suffix}`
    : index > lastCoding
      ? `c.*${index - lastCoding}${suffix}`
      : `c.${index - firstCoding + 1}${suffix}`
}

// The single entry point, so the exon a readout names and the coordinate
// beside it come from one walk; this runs on every mousemove.
export function transcriptPosition(
  coords: TranscriptCoords,
  bpPos: number,
): TranscriptPosition | undefined {
  const axis = transcriptionAxis(coords)
  const located = locateOnAxis(axis, toAxis(coords, bpPos))
  return located
    ? { ...located, hgvs: hgvsCoordinate(coords, axis, located) }
    : undefined
}
