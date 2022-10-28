import { polarToCartesian, assembleLocString, Region } from '@jbrowse/core/util'
import { thetaRangesOverlap } from './viewportVisibleRegion'

export class Slice {
  key: string

  offsetRadians: number

  startRadians: number

  endRadians: number

  bpPerRadian: number

  flipped: boolean

  constructor(
    view: { bpPerRadian: number },
    public region: Region & { widthBp: number; elided: boolean },
    currentRadianOffset: number,
    public radianWidth: number,
  ) {
    const { bpPerRadian } = view
    this.key = assembleLocString(region)
    this.offsetRadians = currentRadianOffset
    this.bpPerRadian = bpPerRadian
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
    return Object.fromEntries(Object.entries(this))
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
