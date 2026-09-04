import {
  CS_FIRST_OF_PAIR,
  CS_INSERT_SIZE,
  CS_IS_AND_ORIENT,
  CS_MAPQ,
  CS_MODIFICATIONS,
  CS_NORMAL,
  CS_PAIR_ORIENT,
  CS_STRAND,
  CS_TAG,
} from '../shaders/slang/read.consts.generated.ts'
import { COLOR_SCHEMES } from '../shared/colorSchemes.ts'

import type { ColorSchemeType, ShaderScheme } from '../shared/types.ts'

export {
  INSERTION_SERIF_MIN_PX_PER_BP,
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
}

// colorBy.type → the shader's dispatch index, via the registry's shader path.
// Total over ColorSchemeType, so no call site needs a fallback. Lossy — several
// schemes share a path — so it feeds the shader uniform and nothing else.
export function colorSchemeIndexFor(type: ColorSchemeType) {
  return ColorScheme[COLOR_SCHEMES[type].shaderScheme]
}

// Linked-reads layout mode. 'off' → ordinary pileup; 'normal' → chain layout
// grouping mates/supplementary alignments onto shared rows with connecting
// lines. Bezier connection curves are orthogonal to layout (see the
// `showBezierConnections` flag) and draw over either mode.
//
// The list is also the `linkedReads` config enumeration (a promotable
// `maybeStringEnum`, so the unset inherit state is NOT a member — see
// promotableResolve.ts). One source so the schema and the resolved type can't
// drift; likewise for the two below.
//
// It is two members, so "is chain layout on" is binary and `!== 'off'` (the
// worker, the menu row) and `=== 'normal'` (the model's `isChainMode`) are the
// same question. They were not always: a third member, 'bezier', is now the
// orthogonal `showBezierConnections` flag. Adding a member means revisiting both
// spellings and `setLinkedReads`, which currently treats any change as
// entering-or-leaving chain mode.
export const LINKED_READS_MODES = ['off', 'normal'] as const
export type LinkedReadsMode = (typeof LINKED_READS_MODES)[number]

// How read connections (mate pairs + split/chimeric reads) are rendered.
// Orthogonal to direction (readConnectionsDown): 'arc' draws regular arcs;
// 'cloud' (read cloud) draws flat lines at Y=|tlen|, discordant pairs only.
// Both color by arcColorByType (red/green/teal/navy by insert size + orientation).
export const READ_CONNECTIONS_MODES = ['off', 'arc', 'cloud'] as const
export type ReadConnectionsMode = (typeof READ_CONNECTIONS_MODES)[number]

// Sashimi junction-arc placement, owned by sashimi alone (decoupled from the
// paired-end `readConnectionsDown`). Defined next to the side-assignment
// algorithm it selects and re-exported here for the display-layer model and
// menus. 'auto' is the default.
export {
  SASHIMI_ARCS_MODES,
  type SashimiArcsMode,
} from '../features/sashimi/junctions.ts'

// Default supporting-read floor for a sashimi junction: hide single-read
// junctions, which are dominated by alignment noise and unreadable at the 1px
// stroke `strokeWidthForCount` floors them to. Lets the menu's reset/is-default
// check name the default instead of hardcoding a bare 2. Must match the
// `minSashimiScore` slot default in configSchema.ts, which spells the same
// number as a literal so the config docgen can render it (it reads the AST
// node's source text, so a reference here would publish as the identifier).
export const DEFAULT_MIN_SASHIMI_SCORE = 2

// Default reads a translocation breakpoint must gather before its connector
// ticks are drawn. Same shape and the same reason as the sashimi floor above —
// single-read marks are dominated by mismapping — and spelled as a literal in
// `configSchema.ts` for the same docgen reason. Keep the two in step.
//
// What differs is how the reads are COUNTED: over a window of one fragment
// length on both sides rather than at a coordinate, since a mate pair straddles
// a breakpoint instead of landing on it (`clusteredInterchromSupport`). Measured
// on HG002 300x, 200 kb at 1:2,000,000: 844 of 856 breakpoints carried exactly
// one read, and widening the window from 0 to 2 kb merged only five clusters —
// so they are scattered rather than badly keyed, which is what makes them
// droppable.
export const DEFAULT_MIN_INTERCHROM_SUPPORT = 2

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
