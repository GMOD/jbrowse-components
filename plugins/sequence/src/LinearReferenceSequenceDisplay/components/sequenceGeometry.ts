import { getContrastText } from '@jbrowse/core/ui/palette'
import { defaultStarts } from '@jbrowse/core/util'

import type { ColorQuad, JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Frame } from '@jbrowse/core/util'

/**
 * One painted cell: the fill, and the text color legible on top of it. Paired
 * at build time because every draw site needs both and looking them up from two
 * structures keyed the same way is how they drift — the letter contrast used to
 * live in a parallel `TextColors` map computed with its own luminance formula,
 * so a base's letter and a start codon's letter answered "is this background
 * dark?" two different ways in the same function.
 */
export interface SeqColor {
  fill: string
  text: string
}

export interface ColorPalette {
  bases: Map<string, SeqColor>
  frames: Map<Frame, SeqColor>
  start: SeqColor
  stop: SeqColor
  fallback: SeqColor
}

// Anything with no palette entry of its own: IUPAC ambiguity codes, and every
// residue of a peptide track.
const FALLBACK_FILL = '#aaaaaa'

// The palette already resolved a contrast color for each augmented color, by
// WCAG contrast ratio — reuse it rather than re-deriving one.
function fromQuad({ main, contrastText }: ColorQuad): SeqColor {
  return { fill: main, text: contrastText }
}

// For the palette's bare color strings (start/stop codon), which carry no
// resolved shades.
function fromString(fill: string): SeqColor {
  return { fill, text: getContrastText(fill) }
}

export function buildColorPalette(
  palette: JBrowsePalette,
  colorByCDS: boolean,
): ColorPalette {
  // Frames array layout: [null, f1, f2, f3, f-3, f-2, f-1]
  // null at index 0 lets positive frames use 1-based .at(1/2/3);
  // negative frames use JS .at() negative-index semantics.
  // colorByCDS matches the bright per-frame CDS palette used by gene tracks so
  // the translation rows line up visually with colored CDS features.
  const framePalette = colorByCDS ? palette.framesCDS : palette.frames
  return {
    // every base the palette declares, not a hard-coded A/C/G/T: `N` has a
    // deliberately distinct hue there ("so it never blends into the grey
    // coverage histogram") and this was the one consumer painting it with the
    // grey fallback instead.
    bases: new Map(
      Object.entries(palette.bases).map(([base, quad]) => [
        base,
        fromQuad(quad),
      ]),
    ),
    frames: new Map(
      ([1, 2, 3, -1, -2, -3] as Frame[]).map(frame => [
        frame,
        fromQuad(framePalette.at(frame)!),
      ]),
    ),
    start: fromString(palette.startCodon),
    stop: fromString(palette.stopCodon),
    fallback: fromString(FALLBACK_FILL),
  }
}

// A single stacked row as painted by drawSequenceBlocks, top-to-bottom. `base`
// rows carry a conceptual strand (+ forward, - reverse); `translation` rows
// carry their reading frame.
export type SequenceRow =
  | { type: 'base'; strand: 1 | -1 }
  | { type: 'translation'; frame: Frame }

/**
 * Which of the stacked rows this display is showing. The three travel together
 * everywhere — the model's height, the render state, the painter, the hover —
 * so they travel as one value rather than three parallel booleans each caller
 * re-lists.
 */
export interface RowVisibility {
  showForward: boolean
  showReverse: boolean
  showTranslation: boolean
}

/**
 * Top-to-bottom row order for a block. **Everything downstream is derived from
 * this**: the painter's loop, the hover's mouse-y lookup, and the model's row
 * count. The painter and the hover used to hold separate copies of the frame
 * ordering and the `reversed` swap — kept in agreement by a comment on each
 * asking the reader to go check the other — and the row *count* was a third
 * encoding, as arithmetic (`baseRows * (translation ? 4 : 1)`).
 */
export function rowLayout(
  { showForward, showReverse, showTranslation }: RowVisibility,
  reversed: boolean,
): SequenceRow[] {
  const forwardFrames: Frame[] = showTranslation && showForward ? [3, 2, 1] : []
  const reverseFrames: Frame[] =
    showTranslation && showReverse ? [-1, -2, -3] : []
  const [topFrames, bottomFrames] = reversed
    ? [reverseFrames.toReversed(), forwardFrames.toReversed()]
    : [forwardFrames, reverseFrames]

  return [
    ...topFrames.map((frame): SequenceRow => ({ type: 'translation', frame })),
    ...(showForward ? [{ type: 'base', strand: 1 } as const] : []),
    ...(showReverse ? [{ type: 'base', strand: -1 } as const] : []),
    ...bottomFrames.map((frame): SequenceRow => ({
      type: 'translation',
      frame,
    })),
  ]
}

/**
 * Whether a base row shows the complement of the forward sequence: the forward
 * row does when the block is flipped, the reverse row does when it isn't — the
 * two swap under reversal. Shared so the painted letter and the hovered letter
 * can't disagree.
 */
export function baseRowComplemented(strand: 1 | -1, reversed: boolean) {
  return strand === 1 ? reversed : !reversed
}

/**
 * How many stacked rows the display occupies. Orientation only reorders the
 * stack, so the count is asked for the forward case and holds for both — and it
 * is a `.length`, not arithmetic that has to be re-checked against
 * {@link rowLayout} every time a row is added.
 */
export function rowCount(visibility: RowVisibility) {
  return rowLayout(visibility, false).length
}

const startsSet = new Set(defaultStarts)

export type CodonKind = 'start' | 'stop' | 'normal'

// Stops come from the active genetic code (a codon mapping to '*'), so e.g. the
// mitochondrial code marks AGA/AGG as stops and TGA as Trp. Start highlighting
// stays ATG-only: alternative initiators (GTG/TTG) only act as starts at a true
// CDS 5' end, so flagging every occurrence in a raw 3-frame translation would be
// misleading noise.
export function codonKind(
  upperCodon: string,
  codonTable: Record<string, string>,
): CodonKind {
  return startsSet.has(upperCodon)
    ? 'start'
    : codonTable[upperCodon] === '*'
      ? 'stop'
      : 'normal'
}

/**
 * `frameShift` is the index of the first in-frame codon boundary (so the codon
 * grid is anchored to absolute genomic coordinate mod 3, independent of where
 * the fetched region happens to start); `sliceEnd` is the index just past the
 * last complete codon.
 */
export function frameShiftBounds(seq: string, seqStart: number, frame: Frame) {
  const normalizedFrame = Math.abs(frame) - 1
  const seqFrame = seqStart % 3
  const frameShift = (normalizedFrame - seqFrame + 3) % 3
  const adjLen = seq.length - frameShift
  const sliceEnd = frameShift + adjLen - (adjLen % 3)
  return { frameShift, sliceEnd }
}

/**
 * Half-open `[start, end)` index range into a sequence that overlaps a block.
 * `Math.floor`/`Math.ceil` cover fractional bpPerPx where block edges land on
 * non-integer genomic positions.
 */
export function visibleRange(
  blockStart: number,
  blockEnd: number,
  seqStart: number,
  seqLen: number,
) {
  return {
    start: Math.max(0, Math.floor(blockStart - seqStart)),
    end: Math.min(seqLen, Math.ceil(blockEnd - seqStart)),
  }
}

/**
 * Codon-aligned half-open `[start, end)` index range to paint for one frame:
 * the visible range widened by one codon of slop (so a codon straddling either
 * edge still renders), snapped back to the `frameShift` codon grid, and clamped
 * to the last complete codon (`sliceEnd`).
 */
export function visibleCodonRange(
  blockStart: number,
  blockEnd: number,
  seqStart: number,
  seqLen: number,
  frameShift: number,
  sliceEnd: number,
) {
  const { start, end } = visibleRange(blockStart, blockEnd, seqStart, seqLen)
  const from = Math.max(frameShift, start - 3)
  return {
    start: from - ((from - frameShift) % 3),
    end: Math.min(sliceEnd, end + 3),
  }
}
