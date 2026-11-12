import { sameStrings } from '@jbrowse/core/util/sameStrings'

import { sameLaneJunction } from '../features/sashimi/supportingReads.ts'

import type { HoveredJunction } from '../features/sashimi/supportingReads.ts'
import type { ArcHighlight } from './components/arcHitTest.ts'
import type { TooltipPayload } from './components/tooltipUtils.ts'

export interface HoverCoverageBand {
  topOffset: number
  coverageHeight: number
}

export interface AlignmentsHover {
  overCigarItem: boolean
  featureIdUnderMouse: string | undefined
  mouseoverExtraInformation: TooltipPayload | undefined
  hoverCoverageBand?: HoverCoverageBand
  hoveredArcHighlight?: ArcHighlight
  hoveredJunction?: HoveredJunction
  hoveredConnectorReadIds?: string[]
}

export const NO_CONNECTOR_READ_IDS: string[] = []

// Carries the previous junction and connector ends into the new hover when
// they are equal: a fresh junction or an equal array invalidates `hoverInk`,
// an O(reads) rebuild per mousemove.
export function nextHover(
  prev: AlignmentsHover | undefined,
  state: AlignmentsHover,
): AlignmentsHover {
  const prevJunction = prev?.hoveredJunction
  const prevEnds = prev?.hoveredConnectorReadIds ?? NO_CONNECTOR_READ_IDS
  const ends = state.hoveredConnectorReadIds ?? NO_CONNECTOR_READ_IDS
  return {
    ...state,
    hoveredJunction: sameLaneJunction(prevJunction, state.hoveredJunction)
      ? prevJunction
      : state.hoveredJunction,
    hoveredConnectorReadIds: sameStrings(prevEnds, ends) ? prevEnds : ends,
  }
}
