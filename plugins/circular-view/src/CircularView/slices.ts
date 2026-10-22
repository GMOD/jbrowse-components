import { assembleLocStringRaw } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

export interface SliceElidedRegion {
  elided: true
  widthBp: number
  regions: Region[]
}

/**
 * A displayed region as the circle lays it out: `circular` where it is a whole
 * sequence its assembly lists in `circularRefNames`.
 */
export type CircleRegion = Region & { circular?: boolean }

export interface SliceNonElidedRegion {
  elided: false
  widthBp: number
  start: number
  end: number
  refName: string
  assemblyName: string
  reversed?: boolean
  circular?: boolean
}
export type SliceRegion = SliceNonElidedRegion | SliceElidedRegion

/**
 * A base's offset in bp into its slice: counted backwards through a reversed
 * slice, and at the middle of an elided one, where no base can be told apart.
 */
function offsetInSlice(
  slice: {
    elided: boolean
    widthBp: number
    start?: number
    reversed?: boolean
  },
  bp: number,
) {
  if (slice.elided || slice.start === undefined) {
    return slice.widthBp / 2
  }
  const offset = bp - slice.start
  return slice.reversed ? slice.widthBp - offset : offset
}

/**
 * The angle of a base in a slice. A `reversed` region's first base sits at
 * the slice's end angle, which lays the second genome of a two-genome circle
 * out as a mirror of the first (`mirrorRegionsForCircle`).
 */
export function bpToRadians(
  slice: Pick<Slice, 'startRadians' | 'bpPerRadian' | 'region'>,
  bp: number,
) {
  return (
    slice.startRadians + offsetInSlice(slice.region, bp) / slice.bpPerRadian
  )
}

function elidedKey(regions: Region[]) {
  return `${assembleLocStringRaw(regions[0]!)}..${assembleLocStringRaw(regions.at(-1)!)}[${regions.length}]`
}

/**
 * One wedge of the circle: a displayed region (or a run of elided ones) placed
 * at a fixed angular span. The unit of geometry every circular display draws
 * against.
 */
export class Slice {
  key: string

  startRadians: number

  endRadians: number

  bpPerRadian: number

  constructor(
    view: { bpPerRadian: number },
    public region: SliceRegion,
    offsetRadians: number,
  ) {
    const { bpPerRadian } = view
    this.key = region.elided
      ? elidedKey(region.regions)
      : assembleLocStringRaw(region)
    this.bpPerRadian = bpPerRadian
    this.startRadians = offsetRadians
    this.endRadians = region.widthBp / bpPerRadian + offsetRadians
  }
}

// how many inter-slice gaps separate one genome's arc from the next
export const GENOME_GAP_UNITS = 4

export function regionAssemblyName(region: SliceRegion) {
  return region.elided ? region.regions[0]?.assemblyName : region.assemblyName
}

/** A circle of one circular sequence, whose end meets its start. */
export function closesRing(regions: readonly SliceRegion[]) {
  const [only, ...rest] = regions
  return !!only && rest.length === 0 && !only.elided && !!only.circular
}

/**
 * The gap after each region, in inter-slice gaps: one between two regions of
 * a genome, `GENOME_GAP_UNITS` where the next region, wrapping round to the
 * first, is another genome's. A lone circular sequence closes the ring, its
 * end meeting its start, as a plasmid or organelle map draws.
 */
export function gapUnitsAfter(regions: readonly SliceRegion[]) {
  return closesRing(regions)
    ? [0]
    : regions.map((region, i) =>
        regionAssemblyName(regions[(i + 1) % regions.length]!) ===
        regionAssemblyName(region)
          ? 1
          : GENOME_GAP_UNITS,
      )
}

/**
 * One slice of the circle on the unrolled genome axis: every slice's bases laid
 * end to end, with no gaps. Nothing here moves with a zoom or a rotation, only
 * with the regions and which of them are elided.
 */
export interface AxisSlice {
  index: number
  /** the inter-slice gaps before this slice, a genome boundary counting several */
  gaps: number
  cumBp: number
  widthBp: number
  start: number
  reversed: boolean
  elided: boolean
}

export interface ChordAxis {
  slices: readonly AxisSlice[]
  /** keyed by `sliceKey`; an elided slice answers to each region it swallowed */
  byKey: ReadonlyMap<string, AxisSlice>
}

/** The circle's angular scale: radians per base, and per gap between slices. */
export interface PolarScale {
  radiansPerBp: number
  gapRadians: number
}

export function sliceKey(assemblyName: string, refName: string) {
  return `${assemblyName}\u0000${refName}`
}

export function buildChordAxis(regions: readonly SliceRegion[]): ChordAxis {
  const slices: AxisSlice[] = []
  const byKey = new Map<string, AxisSlice>()
  const units = gapUnitsAfter(regions)
  let cumBp = 0
  let gaps = 0
  for (const region of regions) {
    const slice: AxisSlice = {
      index: slices.length,
      gaps,
      cumBp,
      widthBp: region.widthBp,
      start: region.elided ? 0 : region.start,
      reversed: !region.elided && !!region.reversed,
      elided: region.elided,
    }
    slices.push(slice)
    for (const r of region.elided ? region.regions : [region]) {
      byKey.set(sliceKey(r.assemblyName, r.refName), slice)
    }
    cumBp += region.widthBp
    gaps += units[slice.index]!
  }
  return { slices, byKey }
}

/** A base's place on the unrolled axis. */
export function axisX(slice: AxisSlice, bp: number) {
  return slice.cumBp + offsetInSlice(slice, bp)
}

/** The slices at one scale: each axis slice's span, turned into angles. */
export function layoutSlices(
  regions: readonly SliceRegion[],
  { radiansPerBp, gapRadians }: PolarScale,
  axis = buildChordAxis(regions),
) {
  const view = { bpPerRadian: 1 / radiansPerBp }
  return regions.map((region, i) => {
    const { cumBp, gaps } = axis.slices[i]!
    return new Slice(view, region, cumBp * radiansPerBp + gaps * gapRadians)
  })
}
