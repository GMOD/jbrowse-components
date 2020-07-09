import { thetaRangesOverlap } from './viewportVisibleRegion'

export default ({ jbrequire }) => {
  const { polarToCartesian, assembleLocString, objectFromEntries } = jbrequire(
    '@gmod/jbrowse-core/util',
  )

  class Slice {
    constructor(view, region, currentRadianOffset, radianWidth) {
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

    toJSON() {
      return objectFromEntries(Object.entries(this))
    }
  }

  function calculateStaticSlices(self) {
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

  function sliceIsVisible(self, slice) {
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

  return { calculateStaticSlices, sliceIsVisible }
}
