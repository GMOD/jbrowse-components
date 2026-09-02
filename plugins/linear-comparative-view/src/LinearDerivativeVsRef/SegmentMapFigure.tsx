import { tagColorPalette } from '@jbrowse/core/ui/palette'
import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'

import { derivativeName } from './buildDerivativeVsRefSpec.ts'
import { allocateWidths } from './pathStripBlocks.ts'

import type {
  DerivativeCandidate,
  ReferencePiece,
  SegmentLettering,
} from '@jbrowse/plugin-alignments'

// The segment map SV papers draw by hand: the reference cut into lettered pieces
// with the copies the derivative carries of each stepped above it, and the
// derivative below as the same letters in the order the reads cross them, a
// prime on an inverted piece and a junction mark between segments. Standalone
// SVG, so it saves as a file and drops into a figure panel as it is.

const WIDTH = 720
const MARGIN = 16
const ROW_HEIGHT = 26
const BLOCK_GAP = 2
const CHROM_GAP = 14
const MIN_BLOCK_WIDTH = 22
const COPY_UNIT = 9
const MAX_STEPPED_COPIES = 3
const LEGEND_LINE = 14
const MAX_LEGEND_LINES = 40
const CHAR_WIDTH = 6.5

const STROKE = 'rgba(0,0,0,0.55)'
const INK = '#222'
const MUTED = '#666'

const Y_TITLE = 18
const Y_COPIES_LABEL = 40
const Y_COPIES_BASE = 44 + COPY_UNIT * MAX_STEPPED_COPIES
const Y_CHROM = Y_COPIES_BASE + 26
const Y_REF = Y_CHROM + 6
const Y_REF_SIZES = Y_REF + ROW_HEIGHT + 12
const Y_DER_LABEL = Y_REF_SIZES + 22
const Y_DER = Y_DER_LABEL + 6
const Y_JUNCTIONS = Y_DER + ROW_HEIGHT + 14
const Y_LEGEND = Y_JUNCTIONS + 30

function fill(colorIndex: number) {
  return tagColorPalette[colorIndex % tagColorPalette.length]
}

// What fits inside a block: the whole text, a cut with an ellipsis, or nothing
// at all on a sliver — a letter drawn over a block narrower than itself is
// noise over its neighbour.
function fitText(text: string, width: number) {
  const maxChars = Math.floor((width - 6) / CHAR_WIDTH)
  if (text.length <= maxChars) {
    return text
  }
  return maxChars >= 2 ? `${text.slice(0, maxChars - 1)}…` : ''
}

// Small labels along a row, each on the first line that has room for it, so
// two narrow neighbours read as two names rather than one smear.
function staggered<T>(
  items: { item: T; x: number; textWidth: number }[],
  gap = 4,
) {
  const lineEnds: number[] = []
  return items.map(({ item, x, textWidth }) => {
    let line = lineEnds.findIndex(end => end + gap <= x)
    if (line === -1) {
      line = lineEnds.length
      lineEnds.push(0)
    }
    lineEnds[line] = x + textWidth
    return { item, x, line }
  })
}

function pieceLoc(piece: ReferencePiece) {
  return assembleLocString({
    refName: piece.refName,
    start: piece.start,
    end: piece.end,
  })
}

// One line per piece, the caption a figure legend or a methods paragraph wants:
// `A B C D E′ B′. A = chr3:25,326,822..25,352,683 (25.9Kbp); B = … (6.43Kbp, ×2)`.
export function segmentMapCaption(
  candidate: DerivativeCandidate,
  lettering: SegmentLettering,
  noun: string,
) {
  const pieces = lettering.pieces
    .map(
      piece =>
        `${piece.letter} = ${pieceLoc(piece)} (${getBpDisplayStr(
          piece.end - piece.start,
        )}${
          piece.copies === 0
            ? ', not in derivative'
            : piece.copies > 1
              ? `, ×${piece.copies}`
              : ''
        })`,
    )
    .join('; ')
  return `${lettering.derivative}. ${pieces}. ${candidate.readCount} ${noun}.`
}

interface Placed<T> {
  item: T
  x: number
  width: number
}

// Pieces laid out in reference order, a wider gap where the chromosome changes.
// A piece the derivative skips is drawn no wider than the longest piece it
// carries: a deletion of 2 Mb between two 5 kb arms is real, but drawn to scale
// it is the whole figure and the arms are two slivers.
function layoutPieces(pieces: ReferencePiece[]): Placed<ReferencePiece>[] {
  const chromosomes = new Set(pieces.map(p => p.refName)).size
  const available =
    WIDTH -
    2 * MARGIN -
    CHROM_GAP * (chromosomes - 1) -
    BLOCK_GAP * (pieces.length - chromosomes)
  const carriedMax = Math.max(
    1,
    ...pieces.filter(p => p.copies > 0).map(p => p.end - p.start),
  )
  const widths = allocateWidths(
    pieces.map(p =>
      Math.max(
        1,
        p.copies === 0
          ? Math.min(p.end - p.start, carriedMax)
          : p.end - p.start,
      ),
    ),
    available,
    MIN_BLOCK_WIDTH,
  )
  let x = MARGIN
  return pieces.map((piece, i) => {
    if (i > 0) {
      x += pieces[i - 1]!.refName === piece.refName ? BLOCK_GAP : CHROM_GAP
    }
    const placed = { item: piece, x, width: widths[i]! }
    x += placed.width
    return placed
  })
}

function layoutSegments(
  candidate: DerivativeCandidate,
): Placed<DerivativeCandidate['observedSegments'][number]>[] {
  const segments = candidate.observedSegments
  const available = WIDTH - 2 * MARGIN - BLOCK_GAP * (segments.length - 1)
  const widths = allocateWidths(
    segments.map(seg => Math.max(1, seg.end - seg.start)),
    available,
    MIN_BLOCK_WIDTH,
  )
  let x = MARGIN
  return segments.map((seg, i) => {
    const placed = { item: seg, x, width: widths[i]! }
    x += placed.width + BLOCK_GAP
    return placed
  })
}

function Chevron({ x, y, strand }: { x: number; y: number; strand: number }) {
  const dir = strand === -1 ? -1 : 1
  const half = 4
  return (
    <polyline
      points={`${x - half * dir},${y - half} ${x + half * dir},${y} ${
        x - half * dir
      },${y + half}`}
      fill="none"
      stroke={INK}
      strokeWidth={1.5}
    />
  )
}

export function segmentMapHeight(lettering: SegmentLettering) {
  const lines = Math.min(lettering.pieces.length, MAX_LEGEND_LINES + 1)
  return Y_LEGEND + LEGEND_LINE * lines + MARGIN
}

export default function SegmentMapFigure({
  candidate,
  lettering,
  noun,
}: {
  candidate: DerivativeCandidate
  lettering: SegmentLettering
  noun: string
}) {
  const { pieces, segmentLetters } = lettering
  const colorOf = new Map<string, number>()
  for (const piece of pieces) {
    if (!colorOf.has(piece.refName)) {
      colorOf.set(piece.refName, colorOf.size)
    }
  }
  const placedPieces = layoutPieces(pieces)
  const placedSegments = layoutSegments(candidate)
  const chromosomeLabels = staggered(
    placedPieces
      .filter(
        ({ item }, i) =>
          i === 0 || placedPieces[i - 1]!.item.refName !== item.refName,
      )
      .map(({ item, x }) => ({
        item: item.refName,
        x,
        textWidth: item.refName.length * 5.5,
      })),
  )
  const junctionLabels = staggered(
    placedSegments.slice(1).map(({ x }, i) => ({
      item: i + 1,
      x: x - BLOCK_GAP / 2 - 7,
      textWidth: 14,
    })),
  )
  const height = segmentMapHeight(lettering)
  const legend = pieces.slice(0, MAX_LEGEND_LINES)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={WIDTH}
      height={height}
      viewBox={`0 0 ${WIDTH} ${height}`}
      fontFamily="Helvetica, Arial, sans-serif"
      fontSize={11}
      fill={INK}
    >
      <rect width={WIDTH} height={height} fill="white" />
      <text x={MARGIN} y={Y_TITLE} fontSize={13} fontWeight="bold">
        {derivativeName(candidate)} · {lettering.derivative} ·{' '}
        {candidate.readCount} {noun}
      </text>

      <text x={MARGIN} y={Y_COPIES_LABEL} fontSize={9} fill={MUTED}>
        copies in derivative
      </text>
      {placedPieces.map(({ item: piece, x, width }, i) => {
        const y =
          Y_COPIES_BASE - COPY_UNIT * Math.min(piece.copies, MAX_STEPPED_COPIES)
        const prev = placedPieces[i - 1]
        const step =
          prev && prev.item.refName === piece.refName
            ? Y_COPIES_BASE -
              COPY_UNIT * Math.min(prev.item.copies, MAX_STEPPED_COPIES)
            : undefined
        return (
          <g key={piece.letter}>
            {step !== undefined && step !== y ? (
              <line
                x1={x - BLOCK_GAP / 2}
                x2={x - BLOCK_GAP / 2}
                y1={step}
                y2={y}
                stroke={INK}
                strokeWidth={1.5}
              />
            ) : null}
            <line
              x1={x - (step === undefined ? 0 : BLOCK_GAP / 2)}
              x2={x + width}
              y1={y}
              y2={y}
              stroke={INK}
              strokeWidth={1.5}
            />
            {piece.copies !== 1 && width >= 14 ? (
              <text
                x={x + width / 2}
                y={y - 3}
                textAnchor="middle"
                fontSize={9}
                fill={MUTED}
              >
                ×{piece.copies}
              </text>
            ) : null}
          </g>
        )
      })}

      {chromosomeLabels.map(({ item: refName, x, line }) => (
        <text
          key={refName}
          x={x}
          y={Y_CHROM - 11 * line}
          fontSize={10}
          fill={MUTED}
        >
          {refName}
        </text>
      ))}
      {placedPieces.map(({ item: piece, x, width }) => {
        const skipped = piece.copies === 0
        return (
          <g key={piece.letter}>
            <rect
              x={x}
              y={Y_REF}
              width={width}
              height={ROW_HEIGHT}
              rx={2}
              fill={skipped ? 'white' : fill(colorOf.get(piece.refName)!)}
              stroke={STROKE}
              strokeWidth={1}
              strokeDasharray={skipped ? '3 2' : undefined}
            />
            <text
              x={x + width / 2}
              y={Y_REF + ROW_HEIGHT / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={12}
              fontWeight="bold"
              fill={skipped ? MUTED : INK}
            >
              {fitText(piece.letter, width)}
            </text>
            {width >= 30 ? (
              <text
                x={x + width / 2}
                y={Y_REF_SIZES}
                textAnchor="middle"
                fontSize={9}
                fill={MUTED}
              >
                {fitText(getBpDisplayStr(piece.end - piece.start), width)}
              </text>
            ) : null}
          </g>
        )
      })}

      <text x={MARGIN} y={Y_DER_LABEL} fontSize={9} fill={MUTED}>
        derivative, in the order the {noun} cross it
      </text>
      {placedSegments.map(({ item: seg, x, width }, i) => {
        const run = segmentLetters[i]?.join(' ') ?? ''
        // A narrow block has room for the letters or the chevron, and the
        // letters say more: the prime already carries the direction.
        const withChevron = width - 16 >= run.length * CHAR_WIDTH + 6
        const labelWidth = withChevron ? width - 16 : width
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- position in the path is the segment's identity
          <g key={i}>
            <rect
              x={x}
              y={Y_DER}
              width={width}
              height={ROW_HEIGHT}
              rx={2}
              fill={fill(colorOf.get(seg.refName) ?? 0)}
              stroke={STROKE}
              strokeWidth={1}
            />
            {fitText(run, labelWidth) ? (
              <text
                x={
                  x +
                  width / 2 -
                  (withChevron ? (seg.strand === -1 ? -4 : 4) : 0)
                }
                y={Y_DER + ROW_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight="bold"
              >
                {fitText(run, labelWidth)}
              </text>
            ) : null}
            {withChevron ? (
              <Chevron
                x={seg.strand === -1 ? x + 7 : x + width - 7}
                y={Y_DER + ROW_HEIGHT / 2}
                strand={seg.strand}
              />
            ) : null}
            {i > 0 ? (
              <>
                <line
                  x1={x - BLOCK_GAP / 2}
                  x2={x - BLOCK_GAP / 2}
                  y1={Y_DER - 4}
                  y2={Y_DER + ROW_HEIGHT + 4}
                  stroke={INK}
                  strokeWidth={1.5}
                />
              </>
            ) : null}
          </g>
        )
      })}
      {junctionLabels.map(({ item: n, x, line }) => (
        <text
          key={n}
          x={x + 7}
          y={Y_JUNCTIONS + 10 * line}
          textAnchor="middle"
          fontSize={9}
          fill={MUTED}
        >
          J{n}
        </text>
      ))}

      {legend.map((piece, i) => (
        <text
          key={piece.letter}
          x={MARGIN}
          y={Y_LEGEND + LEGEND_LINE * i}
          fontSize={10}
        >
          <tspan fontWeight="bold">{piece.letter}</tspan> {pieceLoc(piece)} (
          {getBpDisplayStr(piece.end - piece.start)}
          {piece.copies === 0
            ? ', not in derivative'
            : piece.copies > 1
              ? `, ×${piece.copies}`
              : ''}
          )
        </text>
      ))}
      {pieces.length > legend.length ? (
        <text
          x={MARGIN}
          y={Y_LEGEND + LEGEND_LINE * legend.length}
          fontSize={10}
          fill={MUTED}
        >
          … {pieces.length - legend.length} more pieces
        </text>
      ) : null}
    </svg>
  )
}
