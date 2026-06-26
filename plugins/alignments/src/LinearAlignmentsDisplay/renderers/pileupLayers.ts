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
  | 'gap'
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
// This list is the row-instanced feature set (see RenderAlignmentDataRPC/CLAUDE.md
// "Two feature categories"). The position-aggregate coverage-band layers and the
// paired-end arc band are deliberately NOT here: the coverage draws take a
// different signature and the arc band is a separate scissored viewport with its
// own UBO patching, so forcing them into this list would pull per-renderer
// mechanics into shared data. See the renderer-local coverage pass plan /
// `drawArcsPass`.
export const PILEUP_LAYERS: PileupLayer[] = [
  { id: 'connLine', enabled: s => s.linkedReads === 'normal' },
  { id: 'linkedReadLine', enabled: s => s.showLinkedReadLines },
  { id: 'read', enabled: () => true },
  { id: 'overlap', enabled: s => shouldDrawOverlaps(s) },
  { id: 'mod', enabled: s => s.showModifications },
  { id: 'perBaseQual', enabled: s => s.showPerBaseQuality },
  { id: 'gap', enabled: s => s.showMismatches },
  { id: 'mismatch', enabled: s => s.showMismatches },
  { id: 'insertion', enabled: s => s.showMismatches },
  { id: 'clip', enabled: () => true },
  { id: 'softclipBases', enabled: s => s.showSoftClipping },
  { id: 'perBaseLetter', enabled: s => s.showPerBaseLetter },
]
