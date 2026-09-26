import { assembleLocStringRaw, polarToCartesian } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

export interface SliceElidedRegion {
  elided: true
  widthBp: number
  regions: Region[]
}

export interface SliceNonElidedRegion {
  elided: false
  widthBp: number
  start: number
  end: number
  refName: string
  assemblyName: string
  reversed?: boolean
}
export type SliceRegion = SliceNonElidedRegion | SliceElidedRegion

/**
 * Angle (radians) of a genomic position within a slice/block. Elided regions
 * collapse to their midpoint since individual positions aren't resolvable.
 *
 * A `reversed` region runs the other way around the circle: its first base is
 * at the slice's END angle. That is what lays the second genome of a two-genome
 * circle out as a mirror of the first, so the ribbons between them run parallel
 * instead of through the center — see `mirrorRegionsForCircle`.
 */
export function bpToRadians(
  block: {
    startRadians: number
    endRadians: number
    bpPerRadian: number
    region:
      | { elided: true }
      | { elided?: false; start: number; reversed?: boolean }
  },
  bp: number,
) {
  const { region, startRadians, endRadians, bpPerRadian } = block
  if (region.elided) {
    return (startRadians + endRadians) / 2
  }
  const offset = (bp - region.start) / bpPerRadian
  return region.reversed ? endRadians - offset : startRadians + offset
}

function elidedKey(regions: Region[]) {
  return `${assembleLocStringRaw(regions[0]!)}..${assembleLocStringRaw(regions.at(-1)!)}[${regions.length}]`
}

/**
 * One wedge of the circle: a displayed region (or a run of elided ones) placed
 * at a fixed angular span. The unit of geometry every circular display draws
 * against — `bpToXY` turns a genomic coordinate into a point at any radius.
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

  bpToXY(bp: number, radiusPx: number) {
    return polarToCartesian(radiusPx, bpToRadians(this, bp))
  }
}

// how many inter-slice gaps separate one genome's arc from the next
export const GENOME_GAP_UNITS = 4

function regionAssemblyName(region: SliceRegion) {
  return region.elided ? region.regions[0]?.assemblyName : region.assemblyName
}

/**
 * The gap after each region, in inter-slice gaps: one between two regions of
 * a genome, `GENOME_GAP_UNITS` where the next region, wrapping round to the
 * first, is another genome's.
 */
export function gapUnitsAfter(regions: readonly SliceRegion[]) {
  return regions.map((region, i) =>
    regionAssemblyName(regions[(i + 1) % regions.length]!) ===
    regionAssemblyName(region)
      ? 1
      : GENOME_GAP_UNITS,
  )
}

export function calculateStaticSlices(self: {
  elidedRegions: readonly SliceRegion[]
  bpPerRadian: number
  spacingPx: number
  radiusPx: number
}) {
  const slices: Slice[] = []
  let currentRadianOffset = 0
  const { bpPerRadian, spacingPx, radiusPx, elidedRegions } = self
  const units = gapUnitsAfter(elidedRegions)
  elidedRegions.forEach((region, i) => {
    slices.push(new Slice(self, region, currentRadianOffset))
    currentRadianOffset +=
      region.widthBp / bpPerRadian + (units[i]! * spacingPx) / radiusPx
  })
  return slices
}
