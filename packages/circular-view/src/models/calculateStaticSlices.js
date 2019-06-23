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
    // TODO: calculate only slices that are visible
    const slices = []
    let currentRadianOffset = 0
    for (const region of self.visibleRegions) {
      slices.push(new Slice(self, region, currentRadianOffset))
      currentRadianOffset +=
        region.widthBp / self.bpPerRadian + self.spacingPx / self.pxPerRadian
    }
    return slices
  }
}
