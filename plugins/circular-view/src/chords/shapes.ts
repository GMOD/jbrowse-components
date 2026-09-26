import type { ChordCell } from './chordMarks.ts'
import type { ChordEnds, RibbonAngles } from './chordStage.ts'
import type { Feature } from '@jbrowse/core/util'

export interface RibbonShape {
  kind: 'ribbon'
  feature: Feature
  angles: RibbonAngles
  fill: string
  /** the thin fade's and the identity fade's opacity at rest */
  opacity: number
}

export interface ChordShape {
  kind: 'chord'
  feature: Feature
  ends: ChordEnds
  stroke: string
}

/**
 * One drawn record as the SVG side draws it — the export, and the hovered and
 * selected paths over the canvas — placed on the unrotated figure, which the
 * view's SVG turns.
 */
export type Shape = RibbonShape | ChordShape

/** A chord display as the view's canvas and pointer reach it. */
export interface ChordLayerDisplay {
  id: string
  /** what the canvas draws for it, while it has anything to draw */
  chordCell: ChordCell | undefined
  /** the feature drawn under a point CSS px from the centre, screen frame */
  hitAt: (dx: number, dy: number) => Feature | undefined
  clickFeature: (feature: Feature) => void
  shapeLabel: (feature: Feature) => string
}

export interface ChordHit {
  display: ChordLayerDisplay
  feature: Feature
}

/**
 * What the pointer is on: a chord or ribbon, or a chromosome's ideogram band
 * named by its slice's key, which a reorder leaves naming the same
 * chromosome.
 */
export type PointerTarget =
  | ({ kind: 'chord' } & ChordHit)
  | { kind: 'band'; key: string }

export function samePointerTarget(
  a: PointerTarget | undefined,
  b: PointerTarget | undefined,
) {
  return a?.kind === 'chord' && b?.kind === 'chord'
    ? a.display === b.display && a.feature.id() === b.feature.id()
    : a?.kind === 'band' && b?.kind === 'band'
      ? a.key === b.key
      : a === b
}
