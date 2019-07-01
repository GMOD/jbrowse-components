import {
  viewportVisibleSlice,
  thetaRangesOverlap,
} from './viewportVisibleRegion'

export default ({ jbrequire }) => {
  const { polarToCartesian } = jbrequire('@gmod/jbrowse-core/util')

  class Slice {
    flipped = false

    constructor(view, region, currentRadianOffset) {
      const { bpPerRadian } = view
      this.region = region
      this.offsetRadians = currentRadianOffset
      this.bpPerRadian = bpPerRadian

      this.startRadians = this.offsetRadians
      this.endRadians = region.widthBp / this.bpPerRadian + this.offsetRadians
    }

    bpToXY(bp, radiusPx) {
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
  }

  return function calculateStaticSlices(self) {
    const {
      // rho: visibleRhoRange,
      theta: [visibleThetaMin, visibleThetaMax],
    } = viewportVisibleSlice(
      [
        self.scrollX,
        self.scrollX + self.width,
        self.scrollY,
        self.scrollY + self.height,
      ],
      self.centerXY,
      self.radiusPx,
    )

    const slices = []
    let currentRadianOffset = 0
    for (const region of self.elidedRegions) {
      const radianWidth =
        region.widthBp / self.bpPerRadian + self.spacingPx / self.pxPerRadian
      if (
        thetaRangesOverlap(
          currentRadianOffset + self.offsetRadians,
          radianWidth,
          visibleThetaMin,
          visibleThetaMax - visibleThetaMin,
        )
      ) {
        slices.push(new Slice(self, region, currentRadianOffset))
      }
      currentRadianOffset += radianWidth
    }
    return slices
  }
}
