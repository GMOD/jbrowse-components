import { getMate } from '@jbrowse/synteny-core'

import { chordEnds } from './chordGeometry.ts'
import { ribbonAngles } from './ribbonGeometry.ts'

import type { Slice } from '../CircularView/slices.ts'
import type { ChordEnds } from './chordGeometry.ts'
import type { RibbonAngles } from './ribbonGeometry.ts'
import type { Feature } from '@jbrowse/core/util'
import type { DisplayStatusPhase } from '@jbrowse/render-core/displayPhase'

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

/** One drawn record, placed on the circle with the colour it rests in. */
export type Shape = RibbonShape | ChordShape

/**
 * A chord display as the canvas paints it: its shapes, the radius they sit on,
 * and the dimming the SV inspector writes.
 */
export interface ChordPaintSource {
  id: string
  shapes: readonly Shape[]
  radiusPx: number
  bezierRadius: number
  /** the alpha every resting shape paints at, over the colour's own */
  shapeAlpha: number
  /** shapes paint only while ready; a loading or error ring covers them */
  displayPhase: DisplayStatusPhase
  highlightedFeatureIdSet?: Set<string>
}

/** A chord display as the view's pointer reaches it. */
export interface ChordLayerDisplay extends ChordPaintSource {
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

/**
 * An alignment as a ribbon between its two spans, or undefined when either end
 * is on a region the circle is not showing. Each end resolves against its own
 * assembly, which is what a two-genome circle needs.
 */
export function ribbonShape({
  feature,
  sliceFor,
  radius,
  fill,
}: {
  feature: Feature
  sliceFor: (
    assemblyName: string | undefined,
    refName: string,
  ) => Slice | undefined
  radius: number
  fill: string
}): RibbonShape | undefined {
  const mate = getMate(feature)
  const anchorBlock = sliceFor(
    feature.get('assemblyName') as string | undefined,
    feature.get('refName'),
  )
  const mateBlock = mate ? sliceFor(mate.assemblyName, mate.refName) : undefined
  if (!mate || !anchorBlock || !mateBlock) {
    return undefined
  }
  return {
    kind: 'ribbon',
    feature,
    angles: ribbonAngles({
      anchor: {
        block: anchorBlock,
        start: feature.get('start'),
        end: feature.get('end'),
      },
      mate: { block: mateBlock, start: mate.start, end: mate.end },
      strand: feature.get('strand') ?? 1,
      radius,
    }),
    fill,
  }
}

/** A record as a chord between its two ends, or undefined when it draws nothing. */
export function chordShape({
  feature,
  sliceFor,
  radius,
  stroke,
}: {
  feature: Feature
  sliceFor: (refName: string) => Slice | undefined
  radius: number
  stroke: string
}): ChordShape | undefined {
  const ends = chordEnds({ feature, sliceFor, radius })
  return ends ? { kind: 'chord', feature, ends, stroke } : undefined
}
