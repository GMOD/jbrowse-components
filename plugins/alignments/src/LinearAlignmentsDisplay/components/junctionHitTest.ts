import {
  backToFront,
  linkInstance,
  nearestMarkHit,
  recordPath,
} from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { JUNCTION_SIDES } from '../../features/junctions/bandFeed.ts'
import {
  JUNCTION_HITS,
  JUNCTION_MARK,
  JUNCTION_MARKS,
} from '../renderers/junctionMarks.ts'
import { JUNCTION_FEATURE_ID_PREFIX } from './junctionArcs.ts'

import type {
  JunctionsBandFeed,
  JunctionSide,
} from '../../features/junctions/bandFeed.ts'
import type { MergedJunction } from '../../features/junctions/junctions.ts'
import type { JunctionsBandState } from '../renderers/junctionMarks.ts'
import type { ArcHighlight } from './arcHitTest.ts'
import type { TooltipPayload } from './tooltipUtils.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// How far off a junction's stroke the cursor still answers for it. Tighter
// than the read connections' slop, since an up arc lies over the coverage
// histogram and every px it takes is a px the histogram's own hover loses.
const JUNCTION_HIT_SLOP_PX = 2

/**
 * A splice junction as a gesture consumes it, a variant of the union the
 * pileup's hit test answers with: hover lights its supporting reads and a
 * click opens it.
 */
export interface JunctionMarkHit {
  type: 'junctions'
  tooltip: TooltipPayload
  highlight: ArcHighlight
  junction: MergedJunction
  groupKey: string
}

function oneInstance(
  feed: JunctionsBandFeed,
  side: JunctionSide,
  i: number,
): JunctionsBandFeed {
  return { ...feed, [side]: linkInstance(feed[side], i) }
}

/**
 * The ink of one junction, traced by its own mark's painter so the highlight
 * lies on what was painted, clipped to its side's band.
 */
export function junctionHighlight(
  feed: JunctionsBandFeed,
  side: JunctionSide,
  index: number,
  block: RenderBlock,
  state: JunctionsBandState,
): ArcHighlight | undefined {
  const band = state.junctions[side]
  if (!band) {
    return undefined
  }
  const recorder = recordPath()
  JUNCTION_MARK[side].paintBlock(
    recorder.ctx,
    oneInstance(feed, side, index),
    block,
    state,
  )
  return {
    d: recorder.d,
    clip: {
      x: 0,
      y: band.clipTop,
      width: state.canvasWidth,
      height: band.clipHeight,
    },
    lineWidth: recorder.lineWidth,
  }
}

export interface JunctionHover {
  junction: MergedJunction
  highlight: ArcHighlight
}

/**
 * The junction under the cursor in one section, asked of the two marks'
 * own hit tests.
 */
export function resolveJunctionHover(
  xPx: number,
  yPx: number,
  feeds: ReadonlyMap<number, JunctionsBandFeed>,
  state: JunctionsBandState,
): JunctionHover | undefined {
  if (feeds.size === 0) {
    return undefined
  }
  const found = nearestMarkHit(
    JUNCTION_MARKS,
    // both marks span the view, so they are asked over `regionKeys` alone
    [],
    i => feeds.get(i),
    state,
    xPx,
    yPx,
    {
      radiusPx: JUNCTION_HIT_SLOP_PX,
      regionKeys: feeds.keys(),
      candidates: (feed, mark) =>
        inBand(state, JUNCTION_SIDES[mark]!, yPx)
          ? backToFront(0, feed[JUNCTION_HITS[JUNCTION_SIDES[mark]!]].length)
          : [],
    },
  )
  if (!found) {
    return undefined
  }
  const side = JUNCTION_SIDES[found.mark]!
  const junction = found.region[JUNCTION_HITS[side]][found.index]
  const highlight = junctionHighlight(
    found.region,
    side,
    found.index,
    found.block,
    state,
  )
  return junction && highlight ? { junction, highlight } : undefined
}

// A band clips its arcs, so a cursor outside the clip is on no ink of theirs.
function inBand(state: JunctionsBandState, side: JunctionSide, yPx: number) {
  const band = state.junctions[side]
  return (
    band !== undefined &&
    yPx >= band.clipTop &&
    yPx <= band.clipTop + band.clipHeight
  )
}

/**
 * The selected junction's ink in one section, undefined where `featureId`
 * names none of its junctions.
 */
export function selectedJunctionHighlight(
  featureId: string,
  groupKey: string,
  feeds: ReadonlyMap<number, JunctionsBandFeed>,
  state: JunctionsBandState,
): ArcHighlight | undefined {
  const prefix = `${JUNCTION_FEATURE_ID_PREFIX}${groupKey}-`
  if (!featureId.startsWith(prefix)) {
    return undefined
  }
  const key = featureId.slice(prefix.length)
  for (const [regionIdx, feed] of feeds) {
    for (const side of JUNCTION_SIDES) {
      const index = feed[JUNCTION_HITS[side]].findIndex(j => j.key === key)
      if (index !== -1) {
        return junctionHighlight(
          feed,
          side,
          index,
          canvasWideBlock(regionIdx, state.canvasWidth),
          state,
        )
      }
    }
  }
  return undefined
}
