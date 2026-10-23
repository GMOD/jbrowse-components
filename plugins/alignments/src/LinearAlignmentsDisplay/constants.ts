export {
  LABEL_FADE_FLOOR,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  MIN_PX_PER_BP_FOR_TEXT,
  MIN_QUALITY_LETTER_OPACITY,
  getInsertionType,
  insertionBarWidth,
  labelFadeOpacity,
  labelFont,
  minAvailPxForLabel,
  textWidthForNumber,
} from '@jbrowse/alignments-core'
export type { InsertionType } from '@jbrowse/alignments-core'

// What one pileup row stands for: a read, or a chain of a read's mate and
// split segments joined by QNAME. Curved connectors are the orthogonal
// `pileup.showConnectors` and draw over either unit.
export const ALIGNMENTS_UNITS = ['read', 'chain'] as const
export type AlignmentsUnit = (typeof ALIGNMENTS_UNITS)[number]

// The two marks the read-connection band draws, by the menu's words: 'arc'
// rises with the span between its ends, and 'cloud' draws a flat line at
// Y=|tlen|, the modal pairs left out unless `ordinaryPairs.show` keeps them.
// Both color by `readConnections.color`. They share one band and the cloud
// repurposes its Y axis, so they are one choice rather than two switches.
export const READ_CONNECTIONS_MARKS = ['arc', 'cloud'] as const
export type ReadConnectionsMark = (typeof READ_CONNECTIONS_MARKS)[number]

// The same two marks as `readConnections.mark.type` spells them, Vega-Lite's
// mark types: the arcs a link between a pair's ends, the cloud a rule.
export const READ_CONNECTIONS_MARK_TYPES = ['link', 'rule'] as const
export type ReadConnectionsMarkType =
  (typeof READ_CONNECTIONS_MARK_TYPES)[number]

export const READ_CONNECTIONS_MARK_TYPE = {
  arc: 'link',
  cloud: 'rule',
} as const satisfies Record<ReadConnectionsMark, ReadConnectionsMarkType>

export function readConnectionsMarkOf(
  type: ReadConnectionsMarkType,
): ReadConnectionsMark {
  return type === 'rule' ? 'cloud' : 'arc'
}

// What the band draws, as the model's `drawnReadConnections` answers it: a
// mark, or 'off' while `readConnections.show` is. The rows of the "Connection
// overlay" radio, which writes `show` and `mark` together.
export const READ_CONNECTIONS_OPTIONS = [
  { value: 'off', label: 'None' },
  { value: 'arc', label: 'Read arcs' },
  { value: 'cloud', label: 'Read cloud' },
] as const
export type ReadConnectionsMode =
  (typeof READ_CONNECTIONS_OPTIONS)[number]['value']

export function drawnReadConnectionsOf(
  show: boolean,
  mark: ReadConnectionsMark,
): ReadConnectionsMode {
  return show ? mark : 'off'
}

// Which side of the coverage band a layer draws on (`sashimi.placement`,
// `readConnections.placement`): up over it, or down in a band below it. Each
// layer holds its own setting, and only sashimi has 'auto',
// which sends a junction down where it would cross another; arcs have no such
// side assignment, so one shared enum would offer them a value that means
// nothing. Sashimi's list sits beside the side-assignment algorithm it selects.
export const READ_CONNECTIONS_WIDTH_SCALES = ['log', 'linear'] as const
export type ReadConnectionsWidthScale =
  (typeof READ_CONNECTIONS_WIDTH_SCALES)[number]

export const READ_CONNECTIONS_PLACEMENTS = ['up', 'down'] as const
export type ReadConnectionsPlacement =
  (typeof READ_CONNECTIONS_PLACEMENTS)[number]
export {
  SASHIMI_PLACEMENTS,
  type SashimiPlacement,
} from '../features/sashimi/junctions.ts'

// Whether a point feature (mismatch / small insertion) may intercept a
// click/hover. Clickable when zoomed to base level (bpPerPx <= 1), when
// frequency filtering is off (the feature then draws fully opaque), or when its
// frequency survived the depth-dependent draw threshold. The
// `mismatchFrequencies`/`interbaseFrequencies` bytes are pre-zeroed below
// `featureFrequencyThreshold` (see computeFrequenciesAndThresholds), and the
// draw fade reads that same array, so `> 0` == "drawn as signal, not the noise
// floor". Single source of truth so the mismatch and insertion gates can't
// drift apart.
//
// This gates on *significance*, not visibility: below-threshold features must
// not steal clicks from the read body underneath. Visibility is a separate,
// gradual thing — a zeroed feature still paints at `frequencyFade`'s floor
// (alpha == pxPerBp), which is genuinely faint only once well past 1 bp/px. So
// between ~1 and ~3 bp/px a thresholded feature is plainly visible yet
// deliberately inert. Don't "fix" that by keying this off drawn alpha; that
// would hand clicks back to the noise this is meant to suppress.
export function passesFrequencyGate(
  bpPerPx: number,
  frequencyByte: number,
  fadeLowFrequency: boolean,
) {
  return bpPerPx <= 1 || !fadeLowFrequency || frequencyByte > 0
}

// Returns the minimum frequency at which a feature (mismatch, insertion, etc.)
// is shown at a given coverage depth. Features below this threshold are zeroed
// out. At low depth we require high frequency (80%) since a single read's noise
// is more visible; at high depth we relax to 30% since the signal is more
// statistically meaningful.
export function featureFrequencyThreshold(depth: number) {
  if (depth < 10) {
    return 0.8
  }
  if (depth >= 30) {
    return 0.3
  }
  return 0.8 + ((depth - 10) / 20) * (0.3 - 0.8)
}
