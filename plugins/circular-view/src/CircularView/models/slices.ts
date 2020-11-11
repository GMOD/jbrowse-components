import {
  polarToCartesian,
  assembleLocString,
  objectFromEntries,
  Region,
} from '@jbrowse/core/util'
import { thetaRangesOverlap } from './viewportVisibleRegion'

export class Slice {
  key: string

  region: Region & { widthBp: number; elided: boolean }

  offsetRadians: number

  startRadians: number

  endRadians: number

  bpPerRadian: number

  radianWidth: number

  flipped: boolean

  constructor(
    view: { bpPerRadian: number },
    region: Region & { widthBp: number; elided: boolean },
    currentRadianOffset: number,
    radianWidth: number,
  ) {
    const { bpPerRadian } = view
    this.key = assembleLocString(region)
    this.region = region
    this.offsetRadians = currentRadianOffset
    this.bpPerRadian = bpPerRadian
    this.radianWidth = radianWidth
    this.flipped = false

    this.startRadians = this.offsetRadians
    this.endRadians = region.widthBp / this.bpPerRadian + this.offsetRadians
    Object.freeze(this)
  }

  bpToXY(bp: number, radiusPx: number) {
    let offsetBp
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
    return objectFromEntries(Object.entries(this))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateStaticSlices(self: any) {
  const slices = []
  let currentRadianOffset = 0
  for (const region of self.elidedRegions) {
    const radianWidth =
      region.widthBp / self.bpPerRadian + self.spacingPx / self.pxPerRadian
    slices.push(new Slice(self, region, currentRadianOffset, radianWidth))
    currentRadianOffset += radianWidth
  }
  return slices
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sliceIsVisible(self: any, slice: Slice) {
  const {
    // rho: visibleRhoRange,
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
