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
// 'samplot' (read cloud) draws flat lines at Y=|tlen|, discordant pairs only.
// Both color by arcColorByType (red/green/teal/navy by insert size + orientation).
export type ReadConnectionsMode = 'off' | 'arc' | 'samplot'

// Sashimi junction-arc placement, owned by sashimi alone (decoupled from the
// paired-end `readConnectionsDown`). Defined in the compute layer (it drives the
// arc-assignment algorithm) and re-exported here for the display-layer model and
// menus. 'auto' is the default.
export type { SashimiArcsMode } from '../features/sashimi/computeOverlay.ts'

// Minimum frequency (0-255 scale) for a mismatch/small-insertion to intercept
// a click/hover when bpPerPx > 1. At individual-base zoom (bpPerPx <= 1) clicks
// are precise enough that all features are clickable regardless of frequency.
// 128 ≈ 50%: only positions where at least half of reads share the variant.
export const CIGAR_CLICK_MIN_FREQ = 128

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
