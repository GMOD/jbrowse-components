import {
  normalizedRgbToABGR,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import { LINK_NO_REGION, linkFeet } from '@jbrowse/render-core/marks'
import { GLYPH_SQUARE } from '@jbrowse/render-core/shaders/pointMarkConsts'

import { buildArcColorPalette } from '../../shaders/palettes.ts'
import { ARC_COLOR_INTERCHROM, arcColorSlot } from './arcColors.ts'
import { ARC_SHAPE_FLAT_SPLIT, isFlatArcShape } from './shapes.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { CrossRegionArc, PartnerLocus, RegionInfo } from './arcTypes.ts'
import type { ArcsUploadData } from './types.ts'
import type { LinkChannels, PointChannels } from '@jbrowse/render-core/marks'

/** A connection the band draws, as its hover reports it. */
export interface ArcHit {
  kind: 'arc'
  x1: number
  x2: number
  support: number
  colorType: number
  shapeType: number
  /** |TLEN|, the breakpoint gap or the genomic radius: never the jittered y. */
  spanBp: number
  /** The far foot's chromosome, where it differs from the region's. */
  endRefName?: string
}

/** An interchromosomal breakpoint whose partner the view does not show. */
export interface TickHit {
  kind: 'tick'
  bp: number
  support: number
  partnerRefNames: string[]
  partnerLoci: PartnerLocus[]
}

export type ArcBandHit = ArcHit | TickHit

/**
 * One region's read connections as the band's marks read them, in paint
 * order: the interchromosomal ticks, the arcs or bars, the read cloud's dashed
 * split-read connectors and its endpoint squares, each with the hover record
 * of every instance.
 */
export interface ArcBandFeed {
  ticks: LinkChannels
  links: LinkChannels
  dashed: LinkChannels
  markers: PointChannels
  tickHits: ArcBandHit[]
  linkHits: ArcBandHit[]
  dashedHits: ArcBandHit[]
  markerHits: ArcBandHit[]
}

/** The read cloud's connector alpha, so a dense cloud still reads as density. */
export const CLOUD_LINE_ALPHA = 0.7

class LinkLanes {
  x: number[] = []
  x2: number[] = []
  x2Region: number[] = []
  y: number[] = []
  size: number[] = []
  color: number[] = []
  feet: number[] = []
  hits: ArcBandHit[] = []

  push(
    x: number,
    x2: number,
    x2Region: number,
    y: number,
    support: number,
    color: number,
    feet: number,
    hit: ArcBandHit,
  ) {
    this.x.push(x)
    this.x2.push(x2)
    this.x2Region.push(x2Region)
    this.y.push(y)
    this.size.push(support)
    this.color.push(color)
    this.feet.push(feet)
    this.hits.push(hit)
  }

  channels(): LinkChannels {
    return {
      x: Uint32Array.from(this.x),
      x2: Uint32Array.from(this.x2),
      x2Region: Uint32Array.from(this.x2Region),
      y: Float32Array.from(this.y),
      size: Float32Array.from(this.size),
      color: Uint32Array.from(this.color),
      feet: Uint8Array.from(this.feet),
      count: this.x.length,
    }
  }
}

class MarkerLanes {
  x: number[] = []
  y: number[] = []
  color: number[] = []
  hits: ArcBandHit[] = []

  push(x: number, y: number, color: number, hit: ArcBandHit) {
    this.x.push(x)
    this.y.push(y)
    this.color.push(color)
    this.hits.push(hit)
  }

  channels(): PointChannels {
    const x = Uint32Array.from(this.x)
    return {
      x,
      x2: x,
      y: Float32Array.from(this.y),
      color: Uint32Array.from(this.color),
      glyph: new Uint8Array(x.length).fill(GLYPH_SQUARE),
      count: x.length,
    }
  }
}

class RegionLanes {
  ticks = new LinkLanes()
  links = new LinkLanes()
  dashed = new LinkLanes()
  markers = new MarkerLanes()

  feed(): ArcBandFeed {
    return {
      ticks: this.ticks.channels(),
      links: this.links.channels(),
      dashed: this.dashed.channels(),
      markers: this.markers.channels(),
      tickHits: this.ticks.hits,
      linkHits: this.links.hits,
      dashedHits: this.dashed.hits,
      markerHits: this.markers.hits,
    }
  }
}

function contains(region: RegionInfo | undefined, bp: number) {
  return region !== undefined && bp >= region.start && bp <= region.end
}

export interface ArcBandFeedInput {
  /** Each loaded region's arcs and ticks, every arc filed under one region. */
  byRegion: ReadonlyMap<number, ArcsUploadData>
  /** The arcs whose feet lie in two displayed regions. */
  crossRegion: readonly CrossRegionArc[]
  /** The view's displayed regions, which a far foot resolves against. */
  displayed: readonly RegionInfo[]
  colors: ColorPalette
}

/**
 * Every region's band feed. An arc draws from the region holding its near
 * foot, its far foot placed through the displayed region that holds it, or
 * as a stem where none does; an arc with neither foot in the region it was
 * filed under has nowhere to be placed and draws nothing. An endpoint square
 * goes to the region its mate lies in, so each block places its own.
 */
export function buildArcBandFeeds({
  byRegion,
  crossRegion,
  displayed,
  colors,
}: ArcBandFeedInput): Map<number, ArcBandFeed> {
  const palette = buildArcColorPalette(colors).map(([r, g, b]) =>
    normalizedRgbToABGR(r, g, b),
  )
  const colorOf = (colorType: number, shapeType: number) => {
    const c = palette[arcColorSlot(colorType)]!
    return isFlatArcShape(shapeType)
      ? withAbgrAlpha(c, Math.round(CLOUD_LINE_ALPHA * 255))
      : c
  }
  const regionByIndex = new Map(displayed.map(r => [r.displayedRegionIndex, r]))
  const lanes = new Map<number, RegionLanes>()
  const lanesOf = (index: number) => {
    let l = lanes.get(index)
    if (!l) {
      l = new RegionLanes()
      lanes.set(index, l)
    }
    return l
  }
  const farRegionOf = (own: number, refName: string, bp: number) => {
    if (contains(regionByIndex.get(own), bp)) {
      return own
    }
    const other = displayed.find(
      r => r.refName === refName && bp >= r.start && bp <= r.end,
    )
    return other?.displayedRegionIndex ?? LINK_NO_REGION
  }

  const pushArc = (
    own: number,
    x: number,
    x2: number,
    x2Region: number,
    yBp: number,
    shapeType: number,
    colorType: number,
    support: number,
    feet: number,
    hit: ArcHit,
  ) => {
    const l = lanesOf(own)
    const color = colorOf(colorType, shapeType)
    const target = shapeType === ARC_SHAPE_FLAT_SPLIT ? l.dashed : l.links
    target.push(x, x2, x2Region, yBp, support, color, feet, hit)
    if (isFlatArcShape(shapeType)) {
      const square = palette[arcColorSlot(colorType)]!
      l.markers.push(x, yBp, square, hit)
      if (x2Region !== LINK_NO_REGION) {
        lanesOf(x2Region).markers.push(x2, yBp, square, hit)
      }
    }
  }

  for (const [index, data] of byRegion) {
    const own = regionByIndex.get(index)
    const l = lanesOf(index)
    const tickColor = palette[ARC_COLOR_INTERCHROM]!
    for (let i = 0; i < data.numArcLines; i++) {
      const bp = data.arcLinePositions[i]!
      const support = data.arcLineSupport[i]!
      l.ticks.push(bp, bp, LINK_NO_REGION, 0, support, tickColor, 0, {
        kind: 'tick',
        bp,
        support,
        partnerRefNames: data.arcLinePartnerRefNames[i]!,
        partnerLoci: data.arcLinePartnerLoci[i]!,
      })
    }
    for (let i = 0; i < data.numArcs; i++) {
      const x1 = data.arcX1[i]!
      const x2 = data.arcX2[i]!
      if (own && !contains(own, x1) && !contains(own, x2)) {
        continue
      }
      const swap = !contains(own, x1) && contains(own, x2)
      const near = swap ? x2 : x1
      const far = swap ? x1 : x2
      pushArc(
        index,
        near,
        far,
        own ? farRegionOf(index, own.refName, far) : index,
        data.arcYBp[i]!,
        data.arcShapeTypes[i]!,
        data.arcColorTypes[i]!,
        data.arcSupport[i]!,
        0,
        {
          kind: 'arc',
          x1,
          x2,
          support: data.arcSupport[i]!,
          colorType: data.arcColorTypes[i]!,
          shapeType: data.arcShapeTypes[i]!,
          spanBp: data.arcSpanBp[i]!,
        },
      )
    }
  }

  for (const arc of crossRegion) {
    pushArc(
      arc.p1RegionIndex,
      arc.p1.bp,
      arc.p2.bp,
      arc.p2RegionIndex,
      arc.yBp,
      arc.shapeType,
      arc.colorType,
      arc.support,
      arc.colorType === ARC_COLOR_INTERCHROM
        ? linkFeet(arc.p1Dir, arc.p2Dir)
        : 0,
      {
        kind: 'arc',
        x1: arc.p1.bp,
        x2: arc.p2.bp,
        support: arc.support,
        colorType: arc.colorType,
        shapeType: arc.shapeType,
        spanBp: arc.spanBp,
        ...(arc.p2.refName !== arc.p1.refName
          ? { endRefName: arc.p2.refName }
          : {}),
      },
    )
  }

  const feeds = new Map<number, ArcBandFeed>()
  for (const [index, l] of lanes) {
    feeds.set(index, l.feed())
  }
  return feeds
}

/** A feed with nothing in it, which releases a region's band buffers. */
export const EMPTY_ARC_BAND_FEED: ArcBandFeed = new RegionLanes().feed()

/** Whether a feed paints anything in the band. */
export function feedHasInk(feed: ArcBandFeed) {
  return (
    feed.ticks.count > 0 ||
    feed.links.count > 0 ||
    feed.dashed.count > 0 ||
    feed.markers.count > 0
  )
}
