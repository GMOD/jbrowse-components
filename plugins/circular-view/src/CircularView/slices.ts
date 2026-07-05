import { assembleLocString, polarToCartesian } from '@jbrowse/core/util'

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
}
export type SliceRegion = SliceNonElidedRegion | SliceElidedRegion

/**
 * Angle (radians) of a genomic position within a slice/block. Elided regions
 * collapse to their midpoint since individual positions aren't resolvable.
 */
export function bpToRadians(
  block: {
    startRadians: number
    endRadians: number
    bpPerRadian: number
    region: { elided: true } | { elided?: false; start: number }
  },
  bp: number,
) {
  const { region, startRadians, endRadians, bpPerRadian } = block
  return region.elided
    ? (startRadians + endRadians) / 2
    : (bp - region.start) / bpPerRadian + startRadians
}

export class Slice {
  key: string

  startRadians: number

  endRadians: number

  bpPerRadian: number

  constructor(
    view: { bpPerRadian: number },
    public region: SliceRegion,
    public offsetRadians: number,
    public radianWidth: number,
  ) {
    const { bpPerRadian } = view
    this.key =
      'regions' in region
        ? JSON.stringify(region.regions)
        : assembleLocString(region)
    this.bpPerRadian = bpPerRadian
    this.startRadians = offsetRadians
    this.endRadians = region.widthBp / this.bpPerRadian + offsetRadians
    Object.freeze(this)
  }

  bpToXY(bp: number, radiusPx: number) {
    return polarToCartesian(radiusPx, bpToRadians(this, bp))
  }
}

function calculateStaticSlices(self: {
  elidedRegions: readonly SliceRegion[]
  bpPerRadian: number
  spacingPx: number
  radiusPx: number
}) {
  const slices = []
  let currentRadianOffset = 0
  const { bpPerRadian, spacingPx, radiusPx } = self
  for (const region of self.elidedRegions) {
    const radianWidth = region.widthBp / bpPerRadian + spacingPx / radiusPx
    slices.push(new Slice(self, region, currentRadianOffset, radianWidth))
    currentRadianOffset += radianWidth
  }
  return slices
}

export { calculateStaticSlices }
