import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { linkFeet } from '@jbrowse/render-core/marks'

import { arcCategoryColor } from '../../shaders/palettes.ts'
import { junctionColorClass } from './junctionClass.ts'

import type { ColorPalette } from '../../shaders/colors.ts'
import type { RegionInfo } from '../arcs/arcTypes.ts'
import type { MergedJunction } from './junctions.ts'
import type { LinkChannels } from '@jbrowse/render-core/marks'

export const JUNCTION_SIDES = ['up', 'down'] as const
export type JunctionSide = (typeof JUNCTION_SIDES)[number]

/**
 * One region's junctions as the two junctions marks read them: `up` rising,
 * over the coverage histogram or in the strip above it, and `down` hanging in
 * the strip below it, each ascending by
 * count so a heavy junction paints over, and takes the hover from, a light one
 * near it. `upHits[i]` and `downHits[i]` are the junctions instance `i` draws.
 */
export interface JunctionsBandFeed {
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
export function junctionArcHeightFraction(genomicSpan: number) {
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
export const JUNCTION_MAX_STROKE_PX = 16

/**
 * A junction's stroke in CSS px: a thinner one can be neither seen nor hovered.
 * Not configurable as `readConnections.encoding.strokeWidth` is: no reader has
 * asked, and the 1 px floor would stay under any written scale (declined
 * 2026-11-08).
 */
export function junctionStrokeWidth(count: number) {
  return Math.min(JUNCTION_MAX_STROKE_PX, Math.max(1, Math.log(count + 1)))
}

class SideLanes {
  x: number[] = []
  x2: number[] = []
  x2Region: number[] = []
  y: number[] = []
  size: number[] = []
  color: number[] = []
  feet: number[] = []
  hits: MergedJunction[] = []

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

function feedOf(up: SideLanes, down: SideLanes): JunctionsBandFeed {
  return {
    up: up.channels(),
    down: down.channels(),
    upHits: up.hits,
    downHits: down.hits,
  }
}

export const EMPTY_JUNCTIONS_BAND_FEED = feedOf(
  new SideLanes(),
  new SideLanes(),
)

// The first displayed region holding `bp`, as `bpToPx` resolves a refName the
// view shows twice. Indexed by refName, so a view of thousands of scaffolds
// costs a junction the regions of its own.
function regionFinder(displayed: readonly RegionInfo[]) {
  const byRefName = new Map<string, RegionInfo[]>()
  for (const region of displayed) {
    const regions = byRefName.get(region.refName)
    if (regions) {
      regions.push(region)
    } else {
      byRefName.set(region.refName, [region])
    }
  }
  return (refName: string, bp: number) =>
    byRefName.get(refName)?.find(r => bp >= r.start && bp <= r.end)
      ?.displayedRegionIndex
}

const none = () => undefined

export type JunctionColors = Pick<
  ColorPalette,
  'colorFwdStrand' | 'colorRevStrand' | 'colorPairLR' | 'readCategoryColors'
>

// A splice junction is tinted like the reads supporting it, and an unstranded
// one takes the unpaired-read grey. A split junction takes its class's read-arc
// color in every `readConnections` color field (`junctionsConfigSchema`), and
// a gap deletion the deletion-type one.
export function junctionColor(
  j: Pick<MergedJunction, 'strand' | 'kind'>,
  colors: JunctionColors,
) {
  const colorClass = junctionColorClass(j.kind)
  return normalizedRgbToABGR(
    ...(colorClass
      ? arcCategoryColor(colors, colorClass)
      : j.strand === 1
        ? colors.colorFwdStrand
        : j.strand === -1
          ? colors.colorRevStrand
          : colors.colorPairLR),
  )
}

/**
 * A split junction's breakend feet, from its class: the side each foot's
 * junction keeps, outward for a deletion-type, inward for a duplication-type,
 * both left or both right for an inversion. A splice and a gap deletion, whose
 * orientation is never in doubt, draw none.
 */
export function junctionFeet(j: Pick<MergedJunction, 'kind'>) {
  return j.kind === 'splitForward'
    ? linkFeet(-1, 1)
    : j.kind === 'splitBack'
      ? linkFeet(1, -1)
      : j.kind === 'splitInvLL'
        ? linkFeet(-1, -1)
        : j.kind === 'splitInvRR'
          ? linkFeet(1, 1)
          : 0
}

export interface JunctionsBandFeedInput {
  junctions: readonly MergedJunction[]
  /** By `junctionKey`: the junctions that hang in the strip below coverage, on the `down` mark. */
  downJunctionKeys: ReadonlySet<string>
  /** The view's displayed regions, which each foot resolves against. */
  displayed: readonly RegionInfo[]
  colors: JunctionColors
}

/**
 * Every region's junctions feed. A junction draws from the displayed region
 * holding its start, its end placed through the displayed region that holds
 * it, so one crosses a collapsed intron whole. A junction with a foot on no
 * displayed region has no pixel to hang from and is left out.
 */
export function buildJunctionsBandFeeds({
  junctions,
  downJunctionKeys,
  displayed,
  colors,
}: JunctionsBandFeedInput): Map<number, JunctionsBandFeed> {
  const lanes = new Map<number, { up: SideLanes; down: SideLanes }>()
  const regionHolding = junctions.length > 0 ? regionFinder(displayed) : none
  for (const j of [...junctions].sort((a, b) => a.count - b.count)) {
    const own = regionHolding(j.refName, j.start)
    const far = regionHolding(j.refName, j.end)
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
      side.y.push(junctionArcHeightFraction(Math.abs(j.end - j.start)))
      side.size.push(junctionStrokeWidth(j.count))
      side.color.push(junctionColor(j, colors))
      side.feet.push(junctionFeet(j))
      side.hits.push(j)
    }
  }
  return new Map(
    [...lanes].map(([index, { up, down }]) => [index, feedOf(up, down)]),
  )
}
