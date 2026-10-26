import { SASHIMI_SIDES } from '../../features/sashimi/bandFeed.ts'
import {
  ARC_CLIPPED_MARKS,
  ARC_LINK_MARKS,
  ARC_MARKER_MARK,
  arcBandState,
} from './arcMarks.ts'
import { CONNECTOR_MARK, connectorBandState } from './connectorMarks.ts'
import { SASHIMI_MARK, sashimiBandState } from './sashimiMarks.ts'

import type { RenderState, SectionSource } from './rendererTypes.ts'
import type { Mark, MarkFrame } from '@jbrowse/render-core/marks'

/**
 * One band a section draws over its blocks, clipped to the strip `top` to
 * `top + height`. Each `spanning` mark draws over the whole canvas from every
 * region's feed, so a connection crosses a region seam whole; `perBlock`
 * marks then draw block by block, scissored to the block, `wide` placed
 * canvas-wide and `own` placed by the block itself.
 */
export interface BandPass<F, S extends MarkFrame> {
  section: number
  top: number
  height: number
  state: S
  feeds: ReadonlyMap<number, F>
  spanning: readonly Mark<F, S>[]
  perBlock?: { wide: readonly Mark<F, S>[]; own: readonly Mark<F, S>[] }
}

export interface BandPassVisitor {
  visit<F, S extends MarkFrame>(pass: BandPass<F, S>): void
}

/**
 * The bands both renderers draw after every block, in draw order: each
 * section's pileup connectors, then each section's read connections, then
 * each section's sashimi sides. A band with no feed or no strip is left out.
 */
export function forEachBandPass(
  sections: readonly SectionSource[],
  state: RenderState,
  visitor: BandPassVisitor,
) {
  state.sections.forEach((sec, section) => {
    const feeds = sections[section]?.connectorFeeds
    if (feeds && feeds.size > 0 && sec.connectorClipHeight > 0) {
      visitor.visit({
        section,
        top: sec.connectorClipTop,
        height: sec.connectorClipHeight,
        state: connectorBandState(state, sec),
        feeds,
        spanning: [CONNECTOR_MARK],
      })
    }
  })
  state.sections.forEach((sec, section) => {
    const feeds = sections[section]?.arcFeeds
    const bandState = arcBandState(state, sec)
    if (feeds && feeds.size > 0 && bandState && bandState.arcBand.height > 0) {
      visitor.visit({
        section,
        top: bandState.arcBand.top,
        height: bandState.arcBand.height,
        state: bandState,
        feeds,
        spanning: ARC_LINK_MARKS,
        perBlock: { wide: ARC_CLIPPED_MARKS, own: [ARC_MARKER_MARK] },
      })
    }
  })
  state.sections.forEach((sec, section) => {
    const feeds = sections[section]?.sashimiFeeds
    if (feeds && feeds.size > 0) {
      const bandState = sashimiBandState(state, sec)
      for (const side of SASHIMI_SIDES) {
        const band = bandState.sashimi[side]
        if (band && band.clipHeight > 0) {
          visitor.visit({
            section,
            top: band.clipTop,
            height: band.clipHeight,
            state: bandState,
            feeds,
            spanning: [SASHIMI_MARK[side]],
          })
        }
      }
    }
  })
}
