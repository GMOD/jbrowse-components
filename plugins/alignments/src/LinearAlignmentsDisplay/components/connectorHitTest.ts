import {
  backToFront,
  connectorEnds,
  nearestMarkHit,
  recordPath,
} from '@jbrowse/render-core/marks'
import { canvasWideBlock } from '@jbrowse/render-core/renderBlock'
import { ARC_HIT_SLOP_PX } from '@jbrowse/sv-core'

import { CONNECTOR_MARK } from '../renderers/connectorMarks.ts'

import type {
  ConnectorFeed,
  ConnectorHit,
} from '../../features/linkedReads/connectorFeed.ts'
import type { ConnectorBandState } from '../renderers/connectorMarks.ts'
import type { SectionRender } from '../renderers/rendererTypes.ts'
import type { ArcHighlight } from './arcHitTest.ts'
import type { ConnectorChannels } from '@jbrowse/render-core/marks'

/**
 * A connector as a gesture consumes it, a variant of the union the pileup's
 * hit test answers with: hover names both reads and lights the chain, a click
 * selects the read at the nearer end.
 */
export interface ConnectorMarkHit {
  type: 'connector'
  hit: ConnectorHit
  highlight: ArcHighlight
  /** Which read the click selects: the end nearer the cursor. */
  nearerId: string
}

function pick(c: ConnectorChannels, indices: readonly number[]) {
  const take = <T extends { [i: number]: number }>(
    lane: T,
    make: (n: number) => T,
  ) => {
    const out = make(indices.length)
    indices.forEach((i, k) => {
      out[k] = lane[i]!
    })
    return out
  }
  return {
    x: take(c.x, n => new Uint32Array(n)),
    x2: take(c.x2, n => new Uint32Array(n)),
    x2Region: take(c.x2Region, n => new Uint32Array(n)),
    row: take(c.row, n => new Uint32Array(n)),
    row2: take(c.row2, n => new Uint32Array(n)),
    bend: take(c.bend, n => new Float32Array(n)),
    width: take(c.width, n => new Float32Array(n)),
    color: take(c.color, n => new Uint32Array(n)),
    bits: take(c.bits, n => new Uint8Array(n)),
    count: indices.length,
  }
}

/**
 * The ink of the connectors `which` names in one section, traced by the mark's
 * own painter so the highlight lies on what was painted, clipped to the
 * section's connector band.
 */
export function connectorHighlight(
  feeds: ReadonlyMap<number, ConnectorFeed>,
  which: (hit: ConnectorHit) => boolean,
  sec: SectionRender,
  state: ConnectorBandState,
): ArcHighlight | undefined {
  const recorder = recordPath()
  let any = false
  for (const [regionIdx, feed] of feeds) {
    const indices: number[] = []
    feed.hits.forEach((hit, i) => {
      if (which(hit)) {
        indices.push(i)
      }
    })
    if (indices.length > 0) {
      any = true
      CONNECTOR_MARK.paintBlock(
        recorder.ctx,
        { channels: pick(feed.channels, indices), hits: [] },
        canvasWideBlock(regionIdx, state.canvasWidth),
        state,
      )
    }
  }
  return any && recorder.d
    ? {
        d: recorder.d,
        clip: {
          x: 0,
          y: sec.connectorClipTop,
          width: state.canvasWidth,
          height: sec.connectorClipHeight,
        },
        lineWidth: recorder.lineWidth,
      }
    : undefined
}

/**
 * The connector under the cursor in one section, asked of the mark's own hit
 * test, with every connector of its read lit: a hop of a split read is one
 * event of several.
 */
export function resolveConnectorHover(
  xPx: number,
  yPx: number,
  feeds: ReadonlyMap<number, ConnectorFeed>,
  sec: SectionRender,
  state: ConnectorBandState,
): Omit<ConnectorMarkHit, 'type'> | undefined {
  if (
    feeds.size === 0 ||
    yPx < sec.connectorClipTop ||
    yPx > sec.connectorClipTop + sec.connectorClipHeight
  ) {
    return undefined
  }
  const found = nearestMarkHit(
    [CONNECTOR_MARK],
    [],
    i => feeds.get(i),
    state,
    xPx,
    yPx,
    {
      radiusPx: ARC_HIT_SLOP_PX,
      regionKeys: feeds.keys(),
      candidates: feed => backToFront(0, feed.hits.length),
    },
  )
  const hit = found?.region.hits[found.index]
  if (!found || !hit) {
    return undefined
  }
  const highlight = connectorHighlight(
    feeds,
    h => h.readName === hit.readName,
    sec,
    state,
  )
  const ends = connectorEnds(
    found.region.channels,
    found.block,
    state.connector,
    found.index,
  )
  const nearerId =
    ends && Math.abs(xPx - ends.x2) < Math.abs(xPx - ends.x) ? hit.id2 : hit.id1
  return highlight ? { hit, highlight, nearerId } : undefined
}

/**
 * The connectors of the selected read or chain in one section, undefined where
 * none of them touches it.
 */
export function selectedConnectorHighlight(
  selected: ReadonlySet<string>,
  feeds: ReadonlyMap<number, ConnectorFeed>,
  sec: SectionRender,
  state: ConnectorBandState,
) {
  return selected.size === 0
    ? undefined
    : connectorHighlight(
        feeds,
        h => selected.has(h.id1) || selected.has(h.id2),
        sec,
        state,
      )
}
