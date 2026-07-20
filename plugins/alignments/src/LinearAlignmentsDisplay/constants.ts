import {
  CS_FIRST_OF_PAIR,
  CS_INSERT_SIZE,
  CS_IS_AND_ORIENT,
  CS_IS_GRADIENT,
  CS_MAPQ,
  CS_MODIFICATIONS,
  CS_NORMAL,
  CS_PAIR_ORIENT,
  CS_STRAND,
  CS_TAG,
} from './shaders/slang/read.iface.generated.ts'

import type { ShaderScheme } from '../shared/types.ts'

export {
  INSERTION_SERIF_MIN_PX_PER_BP,
  LONG_INSERTION_MIN_LENGTH,
  LONG_INSERTION_TEXT_THRESHOLD_PX,
  MIN_HEIGHT_FOR_TEXT,
  MIN_LABEL_OPACITY,
  MIN_PX_PER_BP_FOR_TEXT,
  computeLabelFontSize,
  getInsertionType,
  insertionBarWidth,
  labelFadeOpacity,
  textWidthForNumber,
} from '@jbrowse/alignments-core'
export type { InsertionType } from '@jbrowse/alignments-core'

// Maps each shader color-scheme name to its dispatch index. The values come
// straight from read.slang's `export-consts` (see read.generated.ts), so this
// map and the shader switch are generated from one source and cannot drift.
// Typed `Record<ShaderScheme, number>` so it stays exhaustive over the shader
// path names that `COLOR_SCHEMES` resolves through it.
export const ColorScheme: Record<ShaderScheme, number> = {
  normal: CS_NORMAL,
  strand: CS_STRAND,
  mappingQuality: CS_MAPQ,
  insertSize: CS_INSERT_SIZE,
  firstOfPairStrand: CS_FIRST_OF_PAIR,
  pairOrientation: CS_PAIR_ORIENT,
  insertSizeAndOrientation: CS_IS_AND_ORIENT,
  modifications: CS_MODIFICATIONS,
  tag: CS_TAG,
  insertSizeGradient: CS_IS_GRADIENT,
}

export const ALIGNMENTS_FUDGE_FACTOR = 0.8

// Linked-reads layout mode. 'off' → ordinary pileup; 'normal' → chain layout
// grouping mates/supplementary alignments onto shared rows with connecting
// lines. Bezier connection curves are orthogonal to layout (see the
// `showBezierConnections` flag) and draw over either mode.
export type LinkedReadsMode = 'off' | 'normal'

// How read connections (mate pairs + split/chimeric reads) are rendered.
// Orthogonal to direction (readConnectionsDown): 'arc' draws regular arcs;
// 'cloud' (read cloud) draws flat lines at Y=|tlen|, discordant pairs only.
// Both color by arcColorByType (red/green/teal/navy by insert size + orientation).
export type ReadConnectionsMode = 'off' | 'arc' | 'cloud'

// Sashimi junction-arc placement, owned by sashimi alone (decoupled from the
// paired-end `readConnectionsDown`). Defined in the compute layer (it drives the
// arc-assignment algorithm) and re-exported here for the display-layer model and
// menus. 'auto' is the default.
export type { SashimiArcsMode } from '../features/sashimi/computeOverlay.ts'

// Default supporting-read floor for a sashimi junction: hide single-read
// junctions, which are dominated by alignment noise and unreadable at the 1px
// stroke `strokeWidthForCount` floors them to. Lets the menu's reset/is-default
// check name the default instead of hardcoding a bare 2. Must match the
// `minSashimiScore` slot default in configSchema.ts, which spells the same
// number as a literal so the config docgen can render it (it reads the AST
// node's source text, so a reference here would publish as the identifier).
export const DEFAULT_MIN_SASHIMI_SCORE = 2

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
  filterByFrequency: boolean,
) {
  return bpPerPx <= 1 || !filterByFrequency || frequencyByte > 0
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
