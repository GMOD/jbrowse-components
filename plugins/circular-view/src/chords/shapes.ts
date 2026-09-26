import type { ChordCell } from './chordMarks.ts'
import type { ChordEnds, RibbonAngles } from './chordStage.ts'
import type { Feature } from '@jbrowse/core/util'

export interface RibbonShape {
  kind: 'ribbon'
  feature: Feature
  angles: RibbonAngles
  fill: string
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

/** The shape under the pointer, and where the pointer was. */
export interface ChordHover extends ChordHit {
  clientX: number
  clientY: number
}
