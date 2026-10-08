import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import type { PaletteColors } from '../../shaders/colors.ts'
import type { RegionInfo } from '../arcs/arcTypes.ts'
import type { MergedJunction } from './junctions.ts'
import type { LinkChannels } from '@jbrowse/render-core/marks'

export const SASHIMI_SIDES = ['up', 'down'] as const
export type SashimiSide = (typeof SASHIMI_SIDES)[number]

/**
 * One region's junctions as the two sashimi marks read them: `up` over the
 * coverage histogram and `down` in the strip below it, each ascending by
 * count so a heavy junction paints over, and takes the hover from, a light one
 * near it. `upHits[i]` and `downHits[i]` are the junctions instance `i` draws.
 */
export interface SashimiBandFeed {
  up: LinkChannels
  down: LinkChannels
  upHits: MergedJunction[]
  downHits: MergedJunction[]
}

// Arc height follows the junction's genomic span on a fixed log scale, so it is
// zoom-invariant and independent of which other arcs are on screen.
const MIN_ARC_FRAC = 0.3
const MAX_ARC_FRAC = 0.95
const SPAN_REF_MIN_BP = 50
const SPAN_REF_MAX_BP = 100_000
const LOG_REF_MIN = Math.log(SPAN_REF_MIN_BP)
const LOG_REF_RANGE = Math.log(SPAN_REF_MAX_BP) - LOG_REF_MIN

/** A junction's apex as a fraction of its band, the `y` the marks plot on [0, 1]. */
export function sashimiArcHeightFraction(genomicSpan: number) {
  const norm = Math.min(
    1,
    Math.max(
      0,
      (Math.log(Math.max(1, genomicSpan)) - LOG_REF_MIN) / LOG_REF_RANGE,
    ),
  )
  return MIN_ARC_FRAC + (MAX_ARC_FRAC - MIN_ARC_FRAC) * norm
}

/** The widest stroke the size scale passes through unclamped. */
export const SASHIMI_MAX_STROKE_PX = 16

/** A junction's stroke in CSS px: a thinner one can be neither seen nor hovered. */
export function sashimiStrokeWidth(count: number) {
  return Math.min(SASHIMI_MAX_STROKE_PX, Math.max(1, Math.log(count + 1)))
}

class SideLanes {
  x: number[] = []
  x2: number[] = []
  x2Region: number[] = []
  y: number[] = []
  size: number[] = []
  color: number[] = []
  hits: MergedJunction[] = []

  channels(): LinkChannels {
    return {
      x: Uint32Array.from(this.x),
      x2: Uint32Array.from(this.x2),
      x2Region: Uint32Array.from(this.x2Region),
      y: Float32Array.from(this.y),
      size: Float32Array.from(this.size),
      color: Uint32Array.from(this.color),
      count: this.x.length,
    }
  }
}

function feedOf(up: SideLanes, down: SideLanes): SashimiBandFeed {
  return {
    up: up.channels(),
    down: down.channels(),
    upHits: up.hits,
    downHits: down.hits,
  }
}

export const EMPTY_SASHIMI_BAND_FEED = feedOf(new SideLanes(), new SideLanes())

function regionHolding(
  displayed: readonly RegionInfo[],
  refName: string,
  bp: number,
) {
  return displayed.find(
    r => r.refName === refName && bp >= r.start && bp <= r.end,
  )?.displayedRegionIndex
}

export type SashimiColors = Pick<
  PaletteColors,
  'colorFwdStrand' | 'colorRevStrand' | 'colorPairLR'
>

// A junction is tinted like the reads supporting it, and an unstranded one
// takes the unpaired-read grey.
function strandColor(strand: number, colors: SashimiColors) {
  return normalizedRgbToABGR(
    ...(strand === 1
      ? colors.colorFwdStrand
      : strand === -1
        ? colors.colorRevStrand
        : colors.colorPairLR),
  )
}

export interface SashimiBandFeedInput {
  junctions: readonly MergedJunction[]
  /** By `junctionKey`: the junctions the layout sent to the strip below coverage. */
  downJunctionKeys: ReadonlySet<string>
  /** The view's displayed regions, which each foot resolves against. */
  displayed: readonly RegionInfo[]
  colors: SashimiColors
}

/**
 * Every region's sashimi feed. A junction draws from the displayed region
 * holding its start, its end placed through the displayed region that holds
 * it, so one crosses a collapsed intron whole. A junction with a foot on no
 * displayed region has no pixel to hang from and is left out.
 */
export function buildSashimiBandFeeds({
  junctions,
  downJunctionKeys,
  displayed,
  colors,
}: SashimiBandFeedInput): Map<number, SashimiBandFeed> {
  const lanes = new Map<number, { up: SideLanes; down: SideLanes }>()
  for (const j of [...junctions].sort((a, b) => a.count - b.count)) {
    const own = regionHolding(displayed, j.refName, j.start)
    const far = regionHolding(displayed, j.refName, j.end)
    if (own !== undefined && far !== undefined) {
      let region = lanes.get(own)
      if (!region) {
        region = { up: new SideLanes(), down: new SideLanes() }
        lanes.set(own, region)
      }
      // 'up' reserves no strip, so it is the safe side for a junction the
      // layout's merge never saw
      const side = downJunctionKeys.has(j.key) ? region.down : region.up
      side.x.push(j.start)
      side.x2.push(j.end)
      side.x2Region.push(far)
      side.y.push(sashimiArcHeightFraction(Math.abs(j.end - j.start)))
      side.size.push(sashimiStrokeWidth(j.count))
      side.color.push(strandColor(j.strand, colors))
      side.hits.push(j)
    }
  }
  return new Map(
    [...lanes].map(([index, { up, down }]) => [index, feedOf(up, down)]),
  )
}
