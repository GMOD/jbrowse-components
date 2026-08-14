import type { TranscriptCoords } from '../RenderFeatureDataRPC/rpcTypes.ts'

// Where a genomic position falls on a transcript, in the two numbers HGVS needs:
// which transcribed base it is (or is nearest to) and how far into the flanking
// intron it sits.
interface ExonicPosition {
  // 0-based count of transcribed bases before this one, in transcription order
  index: number
  // 0 when the position is exonic; otherwise the signed intron offset, positive
  // measuring forward from the end of exon `index` and negative measuring back
  // from the start of exon `index`
  offset: number
  // 1-based exon this position is in, or is measured from when intronic
  exonNumber: number
  exonCount: number
}

// A located position and the HGVS coordinate naming it. One record rather than
// two calls because the hover wants both off one walk — it names the exon and,
// at base zoom, the c./n. coordinate of the same base — and because a coordinate
// paired with an exon number resolved separately is a pair that can disagree.
interface TranscriptPosition extends ExonicPosition {
  // `c.` when the transcript codes, `n.` when it doesn't, and absent when it
  // codes but can't be numbered; see hgvsCoordinate
  hgvs?: string
}

// One exon on the transcription axis, as an inclusive [first, last] pair.
interface AxisExon {
  first: number
  last: number
}

// Exons in transcription order on a monotonically increasing transcription axis.
// Negating the genomic coordinate on the - strand makes that axis 5'→3' for both
// strands, so every walk below is written once instead of twice.
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

// Locate an already-projected position on the transcript. Exonic positions get
// offset 0. An intronic position is measured from the NEARER flanking exon,
// which is what makes `c.87+1` the first base of an intron and `c.88-1` the
// last; a tie (the middle base of an odd-length intron) goes to the 5' exon, per
// HGVS. Undefined when the position falls outside the transcript entirely.
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

// The transcribed-base indices of the first and last coding bases. On the -
// strand the coding extent's high end is the start codon, so the two genomic
// bounds swap roles. Undefined when the coding bounds don't land in an exon:
// c.1 is the A of a start codon, and a start codon that isn't transcribed can't
// have positions counted off it. Malformed annotation only.
//
// Takes the axis the caller already built: this walks it twice more, and
// rebuilding it each time is what made naming one base cost three axes.
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

// The HGVS coordinate of a located position: `c.` numbered from the A of the
// start codon when the transcript codes, `n.` numbered from its first
// transcribed base when it doesn't.
//
// Positions before the start codon are negative (`c.-24`) and those after the
// stop codon carry `*` (`c.*17`); intronic positions add an offset from the
// nearer exon boundary (`c.87+1`, `c.88-1`), including in the UTRs (`c.-24+1`).
//
// Nothing at all for a transcript that codes but whose coding extent can't be
// placed on it. `n.` is not the fallback: the two prefixes are a claim about
// which kind of transcript this is, so numbering an mRNA `n.151` states that it
// is non-coding in the exact syntax a variant is reported in — and reads as an
// answer rather than as the absence of one. The exon readout beside it is
// measured independently and survives.
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

// Where a genomic position sits on a transcript, and what HGVS calls it.
// Undefined when the position is outside the transcript.
//
// The single entry point, so the exon a readout names and the coordinate beside
// it come from one walk of one axis — this runs on every mousemove, and the two
// used to be separate calls that rebuilt the axis three times between them.
//
// This is the position half of an HGVS name. A complete variant name also needs
// a reference accession and the change itself (`NM_004006.2:c.93+1G>T`); the
// accession is whatever the annotation calls the transcript, which the caller
// has.
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
