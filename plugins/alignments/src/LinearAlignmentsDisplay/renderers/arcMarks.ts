import {
  defineMark,
  linkMark,
  pointMark,
  withPassId,
} from '@jbrowse/render-core/marks'

import { arcStrokeScale } from '../../features/arcs/arcLineWidth.ts'

import type { ArcBandFeed } from '../../features/arcs/bandFeed.ts'
import type { ArcBand, RenderState } from './rendererTypes.ts'
import type { LinkParams, Mark, PointParams } from '@jbrowse/render-core/marks'

/** A section's render state with the band its marks draw in. */
export interface ArcBandState extends RenderState {
  arcBand: ArcBand
}

/** The read cloud's endpoint square, in CSS px. */
export const ARC_MARKER_PX = 5
/** How far inside the band the y scale ends, so a square at either end draws whole. */
export const ARC_BAND_INSET_PX = ARC_MARKER_PX / 2
/** A split-read connector's dash and gap, in CSS px. */
export const ARC_DASH: readonly [number, number] = [3, 3]

/**
 * The band's y scale. The read cloud plots |TLEN| on a log axis; arc mode
 * plots an arc's genomic radius at the view's own px per bp, so a pair inside
 * one region rises as high as it is wide, and an interchromosomal arc, whose
 * radius is past every domain, rises to the band's top. `down` hangs the
 * band from its top.
 */
export function arcBandYScale(state: ArcBandState) {
  const { arcBand, arcsYDomainBp, linkRegions } = state
  const pxPerBp = Math.abs(linkRegions[0]?.signedPxPerBp ?? 0)
  const band = {
    reverse: arcBand.down,
    rowOffsetPx: arcBand.top,
    rowHeight: arcBand.height,
  }
  return arcsYDomainBp === undefined
    ? {
        ...band,
        domain: [0, pxPerBp > 0 ? arcBand.height / pxPerBp : 1] as [
          number,
          number,
        ],
        scaleType: 'linear' as const,
        insetPx: 0,
      }
    : {
        ...band,
        domain: [1, Math.max(2, arcsYDomainBp)] as [number, number],
        scaleType: 'log' as const,
        insetPx: ARC_BAND_INSET_PX,
      }
}

function linkParams(state: ArcBandState, dashed: boolean): LinkParams {
  const cloud = state.arcsYDomainBp !== undefined
  const width = state.readConnectionsLineWidth
  return {
    ...arcBandYScale(state),
    regions: state.linkRegions,
    linkShape: cloud ? 'line' : 'dome',
    valued: true,
    sizePx: width,
    sizeScale: arcStrokeScale(width),
    stemPx: state.arcBand.height,
    strokeDash: dashed ? ARC_DASH : undefined,
  }
}

function markerParams(state: ArcBandState): PointParams {
  return { ...arcBandYScale(state), diameterPx: ARC_MARKER_PX }
}

const bandOpen = (state: ArcBandState) => state.arcBand.height > 0

/**
 * The band's connections, in paint order: the interchromosomal ticks under
 * everything, the arcs or bars, then the read cloud's dashed split-read
 * connectors. Each spans the view, so a connection crosses a region seam
 * whole.
 */
export const ARC_LINK_MARKS: Mark<ArcBandFeed, ArcBandState>[] = [
  defineMark({
    shape: withPassId(linkMark, 'arcTick'),
    channels: (f: ArcBandFeed) => f.ticks,
    params: (s: ArcBandState) => linkParams(s, false),
    enabled: bandOpen,
  }),
  defineMark({
    shape: withPassId(linkMark, 'arcLink'),
    channels: (f: ArcBandFeed) => f.links,
    params: (s: ArcBandState) => linkParams(s, false),
    enabled: bandOpen,
  }),
  defineMark({
    shape: withPassId(linkMark, 'arcLinkDashed'),
    channels: (f: ArcBandFeed) => f.dashed,
    params: (s: ArcBandState) => linkParams(s, true),
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

export const ARC_BAND_MARKS = [...ARC_LINK_MARKS, ARC_MARKER_MARK]
