import {
  defineMark,
  linkMark,
  pointMark,
  withPassId,
} from '@jbrowse/render-core/marks'

import { sectionRenderState } from './rendererTypes.ts'

import type { ArcBandFeed } from '../../features/arcs/bandFeed.ts'
import type {
  ArcBand,
  DisplayRenderState,
  RenderState,
  SectionRender,
} from './rendererTypes.ts'
import type { LinkParams, Mark, PointParams } from '@jbrowse/render-core/marks'

/** A section's render state with the band its marks draw in. */
export interface ArcBandState extends RenderState {
  arcBand: ArcBand
}

/**
 * The state the arc band's marks draw and hit-test a section's band by, or
 * `undefined` for a section that reserves no band.
 */
export function arcBandState(
  state: DisplayRenderState,
  sec: SectionRender,
): ArcBandState | undefined {
  return sec.arcBand
    ? { ...sectionRenderState(state, sec), arcBand: sec.arcBand }
    : undefined
}

/** The read cloud's endpoint square, in CSS px. */
export const ARC_MARKER_PX = 5
/** How far inside the band the y scale ends, so a square at either end draws whole. */
export const ARC_BAND_INSET_PX = ARC_MARKER_PX / 2

/**
 * The read cloud's |TLEN| axis tops out at the widest insert, floored at
 * 1000bp so an all-concordant set never divides by near zero.
 */
export function readCloudDomainBp(maxFlatArcSpanBp: number) {
  return Math.max(1000, maxFlatArcSpanBp)
}

/**
 * The band's y scale short of the view's px per bp. The read cloud plots
 * |TLEN| on a log axis `insetPx` inside the band's edges; arc mode plots an
 * arc's genomic radius on a linear axis whose top, `reachPx`, stops short of
 * the band's far edge by `marginPx`, half the widest stroke, so the band's
 * clip leaves its apex whole. Its domain is `reachPx` over the view's px per
 * bp, so a pair inside one region rises as high as it is wide. `down` hangs
 * the band from its top.
 */
export function arcBandScale(
  band: { height: number; down: boolean },
  maxStrokePx: number,
  cloudDomainBp: number | undefined,
) {
  const marginPx = Math.min(band.height, maxStrokePx / 2)
  return cloudDomainBp === undefined
    ? {
        type: 'linear' as const,
        reverse: band.down,
        marginPx,
        reachPx: band.height - marginPx,
        insetPx: 0,
        domain: null,
      }
    : {
        type: 'log' as const,
        reverse: band.down,
        marginPx: 0,
        reachPx: band.height,
        insetPx: ARC_BAND_INSET_PX,
        domain: [1, Math.max(2, cloudDomainBp)] satisfies [number, number],
      }
}

/** The band's y scale at the view's own px per bp. */
export function arcBandYScale(state: ArcBandState) {
  const { arcBand, linkRegions } = state
  const scale = arcBandScale(
    arcBand,
    Math.max(...state.readConnectionsStrokeScale.range),
    state.arcsYDomainBp,
  )
  const pxPerBp = Math.abs(linkRegions[0]?.signedPxPerBp ?? 0)
  return {
    reverse: scale.reverse,
    rowOffsetPx: arcBand.down ? arcBand.top : arcBand.top + scale.marginPx,
    rowHeight: scale.reachPx,
    domain:
      scale.domain ??
      ([0, pxPerBp > 0 ? scale.reachPx / pxPerBp : 1] satisfies [
        number,
        number,
      ]),
    scaleType: scale.type,
    insetPx: scale.insetPx,
  }
}

function linkParams(state: ArcBandState): LinkParams {
  const cloud = state.arcsYDomainBp !== undefined
  const sizeScale = state.readConnectionsStrokeScale
  return {
    ...arcBandYScale(state),
    regions: state.linkRegions,
    linkShape: cloud ? 'line' : 'dome',
    valued: true,
    sizePx: sizeScale.range[0],
    sizeScale,
    stemPx: state.arcBand.height,
  }
}

function markerParams(state: ArcBandState): PointParams {
  return { ...arcBandYScale(state), diameterPx: ARC_MARKER_PX }
}

const bandOpen = (state: ArcBandState) => state.arcBand.height > 0

/**
 * The band's connections, in paint order: the interchromosomal ticks under
 * everything, the arcs or bars, then the interchromosomal arcs. Each spans the
 * view, so a connection crosses a region seam whole.
 */
export const ARC_LINK_MARKS: Mark<ArcBandFeed, ArcBandState>[] = [
  defineMark({
    shape: withPassId(linkMark, 'arcTick'),
    channels: (f: ArcBandFeed) => f.ticks,
    params: (s: ArcBandState) => linkParams(s),
    enabled: bandOpen,
  }),
  defineMark({
    shape: withPassId(linkMark, 'arcLink'),
    channels: (f: ArcBandFeed) => f.links,
    params: (s: ArcBandState) => linkParams(s),
    enabled: bandOpen,
  }),
  // An interchromosomal arc has no genomic radius, so its dome is half as tall
  // as its two feet are apart on screen.
  defineMark({
    shape: withPassId(linkMark, 'arcCrossLink'),
    channels: (f: ArcBandFeed) => f.crossLinks,
    params: (s: ArcBandState) => ({ ...linkParams(s), valued: false }),
    enabled: bandOpen,
  }),
]

/**
 * The connections reaching past every displayed region on their chromosome,
 * each placed along its own region's axis and drawn block by block under the
 * block's clip, so the far end runs off the block's edge rather than onto a
 * region that does not hold it.
 */
export const ARC_CLIPPED_MARKS: Mark<ArcBandFeed, ArcBandState>[] = [
  defineMark({
    shape: { ...withPassId(linkMark, 'arcLinkClipped'), spansView: false },
    channels: (f: ArcBandFeed) => f.clippedLinks,
    params: (s: ArcBandState) => linkParams(s),
    enabled: bandOpen,
  }),
]

/** The read cloud's endpoint squares, over the connections, per block. */
export const ARC_MARKER_MARK: Mark<ArcBandFeed, ArcBandState> = defineMark({
  shape: withPassId(pointMark, 'arcMarker'),
  channels: (f: ArcBandFeed) => f.markers,
  params: markerParams,
  enabled: bandOpen,
})

export const ARC_BAND_MARKS = [
  ...ARC_LINK_MARKS,
  ...ARC_CLIPPED_MARKS,
  ARC_MARKER_MARK,
]
