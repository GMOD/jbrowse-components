import { shouldDrawOverlaps } from './rendererTypes.ts'

import type { RenderState } from './rendererTypes.ts'

// One pileup-band draw layer. `id` names the layer; `enabled` gates it off the
// display-wide RenderState (not the per-section state — the show flags are the
// same in every section).
export type PileupLayerId =
  | 'connLine'
  | 'linkedReadLine'
  | 'read'
  | 'overlap'
  | 'mod'
  | 'perBaseQual'
  | 'skip'
  | 'deletion'
  | 'mismatch'
  | 'insertion'
  | 'clip'
  | 'softclipBases'
  | 'perBaseLetter'

export interface PileupLayer {
  id: PileupLayerId
  enabled: (state: RenderState) => boolean
}

// Single source of truth for the pileup-band layer set, its z-order (back to
// front), and its visibility gating. Both renderers iterate this list and map
// each id to their own draw mechanism through an exhaustive
// `Record<PileupLayerId, …>` — the GPU renderer to a shader pass id, the
// Canvas2D renderer to a draw function. Because those maps are keyed by the
// PileupLayerId union, adding a layer here is a compile error in either renderer
// until it is wired, so a layer can't be half-added and the two backends can't
// drift on order or gating. `coverageParity.test.ts` cross-checks the result.
//
// The third thing a new layer owes is a HIT-testing story, and it is the one
// that used to be owed only to a comment: what is painted and what answers a
// hover are separate lists, both driven by repaint-tier settings, so a layer
// switched off can keep its marks clickable over blank pixels. `HIT_GATES` in
// `hitTestGateParity.test.ts` is a `Record<PileupLayerId, …>` for the same
// reason the two draw maps are — adding an id there is a compile error until
// the story is written down, and the test checks the classification against
// this list's actual `enabled` behaviour rather than taking its word.
//
// Whether a display wants a list like this at all is
// `agent-docs/reference/DRAW_PASS_REGISTRIES.md` — most don't, and the two other
// registries in tree are not GPU pass lists.
//
// This list is the row-instanced feature set (see RenderAlignmentDataRPC/CLAUDE.md
// "Two feature categories"). The coverage band has a list of its own,
// `COVERAGE_LAYERS`, built the same way and separate because its marks are
// position-aggregate — packed in the worker, drawn from a different signature —
// so one list would have to carry both shapes. The arc band has none: it is four
// GPU passes against one `drawArcs`, a split that follows from a GPU buffer per
// shape rather than from a layer list, and `flatPaintOrder.test.ts` is what pins
// the Canvas2D path to `ARC_PASSES`' order instead.
export const PILEUP_LAYERS: PileupLayer[] = [
  { id: 'connLine', enabled: s => s.chainMode },
  { id: 'linkedReadLine', enabled: s => s.showLinkedReadLines },
  { id: 'read', enabled: () => true },
  { id: 'overlap', enabled: s => shouldDrawOverlaps(s) },
  { id: 'mod', enabled: s => s.showModifications },
  { id: 'perBaseQual', enabled: s => s.showPerBaseQuality },
  // Both are CIGAR gaps out of one worker array and one shader; they are two
  // layers because they answer to different settings. An intron centerline is
  // STRUCTURE: `buildSegmentArrays` splits a spliced read into per-exon
  // segments, so the line is what says those blocks are one read, and without
  // it a spliced read draws as N unrelated ones. A deletion bar is a
  // DIFFERENCE from the reference, and the read body paints straight through
  // the span either way — reads are split at N gaps only — so dropping it
  // understates the read rather than dismembering it, which is what "show
  // mismatches" off asks for.
  { id: 'skip', enabled: () => true },
  { id: 'deletion', enabled: s => s.showMismatches },
  { id: 'mismatch', enabled: s => s.showMismatches },
  { id: 'insertion', enabled: s => s.showMismatches },
  { id: 'clip', enabled: () => true },
  { id: 'softclipBases', enabled: s => s.showSoftClipping },
  { id: 'perBaseLetter', enabled: s => s.showPerBaseLetter },
]
