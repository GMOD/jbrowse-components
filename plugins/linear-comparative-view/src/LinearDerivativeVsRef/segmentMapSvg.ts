import { tagColorPalette } from '@jbrowse/core/ui/palette'
import { assembleLocString, getBpDisplayStr } from '@jbrowse/core/util'

import { derivativeName } from './derivativeName.ts'
import { allocateWidths } from './pathStripBlocks.ts'

import type {
  DerivativeCandidate,
  DerivativeSegment,
  ReferencePiece,
  SegmentLettering,
} from '@jbrowse/plugin-alignments'

// The segment map SV papers draw by hand: the reference cut into lettered pieces
// with the copies the derivative carries of each stepped above it, and the
// derivative below as the same letters in the order the reads cross them, a
// prime on an inverted piece and a junction mark between segments. Built as a
// string so the picker's save button and the website generator share it.

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

function esc(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function fill(colorIndex: number) {
  return tagColorPalette[colorIndex % tagColorPalette.length]!
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

function pieceSize(piece: ReferencePiece) {
  return `${getBpDisplayStr(piece.end - piece.start)}${
    piece.copies === 0
      ? ', not in derivative'
      : piece.copies > 1
        ? `, ×${piece.copies}`
        : ''
  }`
}

// One line per piece, the caption a figure legend or a methods paragraph wants:
// `A B C D E′ B′. A = chr3:25,326,822..25,352,683 (25.9Kbp); B = … (6.43Kbp, ×2)`.
export function segmentMapCaption(
  candidate: DerivativeCandidate,
  lettering: SegmentLettering,
  noun: string,
) {
  const pieces = lettering.pieces
    .map(piece => `${piece.letter} = ${pieceLoc(piece)} (${pieceSize(piece)})`)
    .join('; ')
  return `${lettering.derivative}. ${pieces}. ${candidate.readCount} ${noun}.`
}

interface Placed<T> {
  item: T
  x: number
  width: number
}

// Blocks in a row, proportional to `lengths` with no block under the floor.
// Gaps yield to blocks when there are too many of them for the row: a route
// through sixty chromosomes still draws inside the frame.
function place<T>(items: T[], lengths: number[], gaps: number[]): Placed<T>[] {
  const row = WIDTH - 2 * MARGIN
  const gapTotal = gaps.reduce((a, b) => a + b, 0)
  const gapScale = Math.min(1, row / 2 / Math.max(1, gapTotal))
  const widths = allocateWidths(
    lengths.map(len => Math.max(1, len)),
    row - gapTotal * gapScale,
    MIN_BLOCK_WIDTH,
  )
  let x = MARGIN
  return items.map((item, i) => {
    if (i > 0) {
      x += gaps[i - 1]! * gapScale
    }
    const placed = { item, x, width: widths[i]! }
    x += placed.width
    return placed
  })
}

// Pieces in reference order, a wider gap where the chromosome changes. A piece
// the derivative skips is drawn no wider than the longest piece it carries: a
// deletion of 2 Mb between two 5 kb arms is real, but drawn to scale it is the
// whole figure and the arms are two slivers.
function layoutPieces(pieces: ReferencePiece[]) {
  const carriedMax = Math.max(
    1,
    ...pieces.filter(p => p.copies > 0).map(p => p.end - p.start),
  )
  return place(
    pieces,
    pieces.map(p =>
      p.copies === 0 ? Math.min(p.end - p.start, carriedMax) : p.end - p.start,
    ),
    pieces
      .slice(1)
      .map((p, i) =>
        pieces[i]!.refName === p.refName ? BLOCK_GAP : CHROM_GAP,
      ),
  )
}

function layoutSegments(segments: DerivativeSegment[]) {
  return place(
    segments,
    segments.map(seg => seg.end - seg.start),
    segments.slice(1).map(() => BLOCK_GAP),
  )
}

function chevron(x: number, y: number, strand: number) {
  const dir = strand === -1 ? -1 : 1
  const half = 4
  return `<polyline points="${x - half * dir},${y - half} ${x + half * dir},${y} ${
    x - half * dir
  },${y + half}" fill="none" stroke="${INK}" stroke-width="1.5"/>`
}

function text(
  x: number,
  y: number,
  content: string,
  attrs: Record<string, string | number> = {},
) {
  const extra = Object.entries(attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  return `<text x="${x}" y="${y}"${extra}>${content}</text>`
}

function stepY(copies: number) {
  return Y_COPIES_BASE - COPY_UNIT * Math.min(copies, MAX_STEPPED_COPIES)
}

function segmentMapHeight(lettering: SegmentLettering) {
  const lines = Math.min(lettering.pieces.length, MAX_LEGEND_LINES + 1)
  return Y_LEGEND + LEGEND_LINE * lines + MARGIN
}

export function segmentMapSvg(
  candidate: DerivativeCandidate,
  lettering: SegmentLettering,
  noun: string,
) {
  const { pieces, segmentLetters } = lettering
  const colorOf = new Map<string, number>()
  for (const piece of pieces) {
    if (!colorOf.has(piece.refName)) {
      colorOf.set(piece.refName, colorOf.size)
    }
  }
  const placedPieces = layoutPieces(pieces)
  const placedSegments = layoutSegments(candidate.observedSegments)
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
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="${INK}">`,
    `<rect width="${WIDTH}" height="${height}" fill="white"/>`,
    text(
      MARGIN,
      Y_TITLE,
      esc(
        `${derivativeName(candidate)} · ${lettering.derivative} · ${candidate.readCount} ${noun}`,
      ),
      { 'font-size': 13, 'font-weight': 'bold' },
    ),
    text(MARGIN, Y_COPIES_LABEL, 'copies in derivative', {
      'font-size': 9,
      fill: MUTED,
    }),
  ]

  placedPieces.forEach(({ item: piece, x, width }, i) => {
    const y = stepY(piece.copies)
    const prev = placedPieces[i - 1]
    const step =
      prev && prev.item.refName === piece.refName
        ? stepY(prev.item.copies)
        : undefined
    if (step !== undefined && step !== y) {
      out.push(
        `<line x1="${x - BLOCK_GAP / 2}" x2="${x - BLOCK_GAP / 2}" y1="${step}" y2="${y}" stroke="${INK}" stroke-width="1.5"/>`,
      )
    }
    out.push(
      `<line x1="${x - (step === undefined ? 0 : BLOCK_GAP / 2)}" x2="${x + width}" y1="${y}" y2="${y}" stroke="${INK}" stroke-width="1.5"/>`,
    )
    if (piece.copies !== 1 && width >= 14) {
      out.push(
        text(x + width / 2, y - 3, `×${piece.copies}`, {
          'text-anchor': 'middle',
          'font-size': 9,
          fill: MUTED,
        }),
      )
    }
  })

  for (const { item: refName, x, line } of chromosomeLabels) {
    out.push(
      text(x, Y_CHROM - 11 * line, esc(refName), {
        'font-size': 10,
        fill: MUTED,
      }),
    )
  }

  for (const { item: piece, x, width } of placedPieces) {
    const skipped = piece.copies === 0
    out.push(
      `<rect x="${x}" y="${Y_REF}" width="${width}" height="${ROW_HEIGHT}" rx="2" fill="${
        skipped ? 'white' : fill(colorOf.get(piece.refName)!)
      }" stroke="${STROKE}" stroke-width="1"${skipped ? ' stroke-dasharray="3 2"' : ''}/>`,
    )
    const letter = fitText(piece.letter, width)
    if (letter) {
      out.push(
        text(x + width / 2, Y_REF + ROW_HEIGHT / 2, esc(letter), {
          'text-anchor': 'middle',
          'dominant-baseline': 'central',
          'font-size': 12,
          'font-weight': 'bold',
          fill: skipped ? MUTED : INK,
        }),
      )
    }
    if (width >= 30) {
      out.push(
        text(
          x + width / 2,
          Y_REF_SIZES,
          esc(fitText(getBpDisplayStr(piece.end - piece.start), width)),
          { 'text-anchor': 'middle', 'font-size': 9, fill: MUTED },
        ),
      )
    }
  }

  out.push(
    text(
      MARGIN,
      Y_DER_LABEL,
      esc(`derivative, in the order the ${noun} cross it`),
      { 'font-size': 9, fill: MUTED },
    ),
  )
  placedSegments.forEach(({ item: seg, x, width }, i) => {
    const run = segmentLetters[i]?.join(' ') ?? ''
    // A narrow block has room for the letters or the chevron, and the letters
    // say more: the prime already carries the direction.
    const withChevron = width - 16 >= run.length * CHAR_WIDTH + 6
    const label = fitText(run, withChevron ? width - 16 : width)
    out.push(
      `<rect x="${x}" y="${Y_DER}" width="${width}" height="${ROW_HEIGHT}" rx="2" fill="${fill(
        colorOf.get(seg.refName) ?? 0,
      )}" stroke="${STROKE}" stroke-width="1"/>`,
    )
    if (label) {
      out.push(
        text(
          x + width / 2 - (withChevron ? (seg.strand === -1 ? -4 : 4) : 0),
          Y_DER + ROW_HEIGHT / 2,
          esc(label),
          {
            'text-anchor': 'middle',
            'dominant-baseline': 'central',
            'font-size': 12,
            'font-weight': 'bold',
          },
        ),
      )
    }
    if (withChevron) {
      out.push(
        chevron(
          seg.strand === -1 ? x + 7 : x + width - 7,
          Y_DER + ROW_HEIGHT / 2,
          seg.strand,
        ),
      )
    }
    if (i > 0) {
      out.push(
        `<line x1="${x - BLOCK_GAP / 2}" x2="${x - BLOCK_GAP / 2}" y1="${Y_DER - 4}" y2="${
          Y_DER + ROW_HEIGHT + 4
        }" stroke="${INK}" stroke-width="1.5"/>`,
      )
    }
  })
  for (const { item: n, x, line } of junctionLabels) {
    out.push(
      text(x + 7, Y_JUNCTIONS + 10 * line, `J${n}`, {
        'text-anchor': 'middle',
        'font-size': 9,
        fill: MUTED,
      }),
    )
  }

  legend.forEach((piece, i) => {
    out.push(
      text(
        MARGIN,
        Y_LEGEND + LEGEND_LINE * i,
        `<tspan font-weight="bold">${esc(piece.letter)}</tspan> ${esc(
          pieceLoc(piece),
        )} (${esc(pieceSize(piece))})`,
        { 'font-size': 10 },
      ),
    )
  })
  if (pieces.length > legend.length) {
    out.push(
      text(
        MARGIN,
        Y_LEGEND + LEGEND_LINE * legend.length,
        `… ${pieces.length - legend.length} more pieces`,
        { 'font-size': 10, fill: MUTED },
      ),
    )
  }
  out.push('</svg>')
  return out.join('\n')
}
