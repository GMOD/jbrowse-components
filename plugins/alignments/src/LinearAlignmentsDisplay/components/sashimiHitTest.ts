import {
  backToFront,
  linkInstance,
  nearestMarkHit,
  recordPath,
} from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'

import { SASHIMI_SIDES } from '../../features/sashimi/bandFeed.ts'
import { SASHIMI_MARKS } from '../renderers/sashimiMarks.ts'
import { SASHIMI_FEATURE_ID_PREFIX } from './sashimiArcs.ts'

import type {
  SashimiBandFeed,
  SashimiSide,
} from '../../features/sashimi/bandFeed.ts'
import type { MergedJunction } from '../../features/sashimi/junctions.ts'
import type { SashimiBandState } from '../renderers/sashimiMarks.ts'
import type { ArcHighlight } from './arcHitTest.ts'
import type { TooltipPayload } from './tooltipUtils.ts'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

// How far off a junction's stroke the cursor still answers for it. Tighter
// than the read connections' slop, since an up arc lies over the coverage
// histogram and every px it takes is a px the histogram's own hover loses.
const SASHIMI_HIT_SLOP_PX = 2

/**
 * A splice junction as a gesture consumes it, a variant of the union the
 * pileup's hit test answers with: hover lights its supporting reads and a
 * click opens it.
 */
export interface SashimiMarkHit {
  type: 'sashimi'
  tooltip: TooltipPayload
  highlight: ArcHighlight
  junction: MergedJunction
  groupKey: string
}

const HITS = { up: 'upHits', down: 'downHits' } as const

function oneInstance(
  feed: SashimiBandFeed,
  side: SashimiSide,
  i: number,
): SashimiBandFeed {
  return { ...feed, [side]: linkInstance(feed[side], i) }
}

/**
 * The ink of one junction, traced by its own mark's painter so the highlight
 * lies on what was painted, clipped to its side's band.
 */
export function sashimiHighlight(
  feed: SashimiBandFeed,
  side: SashimiSide,
  index: number,
  block: RenderBlock,
  state: SashimiBandState,
): ArcHighlight | undefined {
  const band = state.sashimi[side]
  if (!band) {
    return undefined
  }
  const recorder = recordPath()
  SASHIMI_MARKS[SASHIMI_SIDES.indexOf(side)]!.paintBlock(
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

export interface SashimiHover {
  junction: MergedJunction
  highlight: ArcHighlight
}

/**
 * The junction under the cursor in one section, asked of the two marks'
 * own hit tests.
 */
export function resolveSashimiHover(
  xPx: number,
  yPx: number,
  feeds: ReadonlyMap<number, SashimiBandFeed>,
  state: SashimiBandState,
): SashimiHover | undefined {
  if (feeds.size === 0) {
    return undefined
  }
  const found = nearestMarkHit(
    SASHIMI_MARKS,
    // both marks span the view, so they are asked over `regionKeys` alone
    [],
    i => feeds.get(i),
    state,
    xPx,
    yPx,
    {
      radiusPx: SASHIMI_HIT_SLOP_PX,
      regionKeys: feeds.keys(),
      candidates: (feed, mark) =>
        inBand(state, SASHIMI_SIDES[mark]!, yPx)
          ? backToFront(0, feed[HITS[SASHIMI_SIDES[mark]!]].length)
          : [],
    },
  )
  if (!found) {
    return undefined
  }
  const side = SASHIMI_SIDES[found.mark]!
  const junction = found.region[HITS[side]][found.index]
  const highlight = sashimiHighlight(
    found.region,
    side,
    found.index,
    found.block,
    state,
  )
  return junction && highlight ? { junction, highlight } : undefined
}

// A band clips its arcs, so a cursor outside the clip is on no ink of theirs.
function inBand(state: SashimiBandState, side: SashimiSide, yPx: number) {
  const band = state.sashimi[side]
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
export function selectedSashimiHighlight(
  featureId: string,
  groupKey: string,
  feeds: ReadonlyMap<number, SashimiBandFeed>,
  state: SashimiBandState,
): ArcHighlight | undefined {
  const prefix = `${SASHIMI_FEATURE_ID_PREFIX}${groupKey}-`
  if (!featureId.startsWith(prefix)) {
    return undefined
  }
  const key = featureId.slice(prefix.length)
  for (const [regionIdx, feed] of feeds) {
    for (const side of SASHIMI_SIDES) {
      const index = feed[HITS[side]].findIndex(j => j.key === key)
      if (index !== -1) {
        return sashimiHighlight(
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
