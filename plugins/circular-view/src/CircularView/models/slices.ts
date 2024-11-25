import { polarToCartesian, assembleLocString } from '@jbrowse/core/util'
import { thetaRangesOverlap } from './viewportVisibleRegion'
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

export class Slice {
  key: string

  startRadians: number

  endRadians: number

  bpPerRadian: number

  flipped: boolean

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
    this.flipped = false

    this.startRadians = offsetRadians
    this.endRadians = region.widthBp / this.bpPerRadian + offsetRadians
    Object.freeze(this)
  }

  bpToXY(bp: number, radiusPx: number) {
    let offsetBp: number | undefined
    if (this.region.elided) {
      offsetBp = this.region.widthBp / 2
    } else if (this.flipped) {
      offsetBp = this.region.end - bp
    } else {
      offsetBp = bp - this.region.start
    }
    const totalRadians = offsetBp / this.bpPerRadian + this.offsetRadians
    return polarToCartesian(radiusPx, totalRadians)
  }

  toJSON() {
    return Object.fromEntries(Object.entries(this))
  }
}

function calculateStaticSlices(self: {
  elidedRegions: readonly SliceRegion[]
  bpPerRadian: number
  spacingPx: number
  pxPerRadian: number
}) {
  const slices = []
  let currentRadianOffset = 0
  const { bpPerRadian, spacingPx, pxPerRadian } = self
  for (const region of self.elidedRegions) {
    const radianWidth = region.widthBp / bpPerRadian + spacingPx / pxPerRadian
    slices.push(new Slice(self, region, currentRadianOffset, radianWidth))
    currentRadianOffset += radianWidth
  }
  return slices
}

function sliceIsVisible(
  self: { offsetRadians: number; visibleSection: { theta: [number, number] } },
  slice: Slice,
) {
  const {
    theta: [visibleThetaMin, visibleThetaMax],
  } = self.visibleSection

  return thetaRangesOverlap(
    slice.offsetRadians + self.offsetRadians,
    slice.radianWidth,
    visibleThetaMin,
    visibleThetaMax - visibleThetaMin,
  )
}

export { calculateStaticSlices, sliceIsVisible }
