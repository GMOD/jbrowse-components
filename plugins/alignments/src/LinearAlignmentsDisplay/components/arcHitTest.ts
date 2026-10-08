import {
  backToFront,
  instanceColor,
  nearestMarkHit,
  recordPath,
} from '@jbrowse/render-core/marks'
import { ARC_HIT_SLOP_PX } from '@jbrowse/sv-core'

import { ARC_BAND_MARKS } from '../renderers/arcMarks.ts'

import type { ArcBandFeed, ArcBandHit } from '../../features/arcs/bandFeed.ts'
import type { ArcBandState } from '../renderers/arcMarks.ts'
import type { TooltipPayload } from './tooltipUtils.ts'
import type { LinkChannels, PointChannels } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/** The band's rect on screen, as the four SVG `<rect>` attributes. */
export interface ArcBandClip {
  x: number
  y: number
  width: number
  height: number
}

/** The ink of the hovered connection, as a path to stroke over it. */
export interface ArcHighlight {
  d: string
  clip: ArcBandClip
  lineWidth: number
  dash?: string
}

/**
 * The band's answer in the shape a gesture consumes, a variant of the union
 * the pileup's hit test answers with, so every gesture declines to act
 * through a connection by the same switch.
 */
export interface ArcMarkHit {
  type: 'arc'
  tooltip: TooltipPayload
  highlight: ArcHighlight
}

export interface ArcBandHover {
  hit: ArcBandHit
  /** The displayed region whose feed holds the connection. */
  regionIndex: number
  highlight: ArcHighlight
}

// Each band mark's channels and hit list on the feed, in `ARC_BAND_MARKS`
// order.
const ARC_BAND_FIELDS = [
  { channels: 'ticks', hits: 'tickHits' },
  { channels: 'links', hits: 'linkHits' },
  { channels: 'crossLinks', hits: 'crossLinkHits' },
  { channels: 'dashed', hits: 'dashedHits' },
  { channels: 'clippedLinks', hits: 'clippedLinkHits' },
  { channels: 'clippedDashed', hits: 'clippedDashedHits' },
  { channels: 'markers', hits: 'markerHits' },
] as const

function hitsOf(feed: ArcBandFeed, mark: number) {
  return feed[ARC_BAND_FIELDS[mark]!.hits]
}

function sliceLink(c: LinkChannels, i: number): LinkChannels {
  const one = <T extends { subarray(a: number, b: number): T }>(a?: T) =>
    a?.subarray(i, i + 1)
  return {
    x: one(c.x)!,
    x2: one(c.x2)!,
    x2Region: one(c.x2Region)!,
    y: one(c.y),
    size: one(c.size),
    color: instanceColor(c.color, i),
    feet: one(c.feet),
    count: 1,
  }
}

function slicePoint(c: PointChannels, i: number): PointChannels {
  return {
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    y: c.y.subarray(i, i + 1),
    color: instanceColor(c.color, i),
    glyph: c.glyph.subarray(i, i + 1),
    count: 1,
  }
}

// The feed with mark `mark` cut down to its instance `i`, so that mark's
// painter traces the one connection.
function oneInstance(feed: ArcBandFeed, mark: number, i: number): ArcBandFeed {
  const key = ARC_BAND_FIELDS[mark]!.channels
  return key === 'markers'
    ? { ...feed, markers: slicePoint(feed.markers, i) }
    : { ...feed, [key]: sliceLink(feed[key], i) }
}

/**
 * What the cursor is on in one section's band, and the ink to draw over it:
 * the band's own marks asked through their hit tests, and the one found
 * traced by its own painter, so the highlight lies on what was painted.
 */
export function resolveArcBandHover(
  xPx: number,
  yPx: number,
  feeds: ReadonlyMap<number, ArcBandFeed>,
  state: ArcBandState,
  blocks: readonly RenderBlock[],
): ArcBandHover | undefined {
  const band = state.arcBand
  if (
    feeds.size === 0 ||
    band.height <= 0 ||
    yPx < band.top ||
    yPx > band.top + band.height
  ) {
    return undefined
  }
  const found = nearestMarkHit(
    ARC_BAND_MARKS,
    blocks,
    i => feeds.get(i),
    state,
    xPx,
    yPx,
    {
      radiusPx: ARC_HIT_SLOP_PX,
      regionKeys: feeds.keys(),
      candidates: (feed, mark) => backToFront(0, hitsOf(feed, mark).length),
    },
  )
  const hit = found && hitsOf(found.region, found.mark)[found.index]
  if (!found || !hit) {
    return undefined
  }
  const mark = ARC_BAND_MARKS[found.mark]!
  const recorder = recordPath()
  mark.paintBlock(
    recorder.ctx,
    oneInstance(found.region, found.mark, found.index),
    found.block,
    state,
  )
  const { screenStartPx, screenEndPx } = found.block
  return {
    hit,
    regionIndex: found.block.displayedRegionIndex,
    highlight: {
      d: recorder.d,
      clip: {
        x: mark.spansView ? 0 : screenStartPx,
        y: band.top,
        width: mark.spansView ? state.canvasWidth : screenEndPx - screenStartPx,
        height: band.height,
      },
      lineWidth: recorder.lineWidth,
      dash: recorder.dash,
    },
  }
}
