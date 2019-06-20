export default ({ jbrequire }) => {
  const { polarToCartesian } = jbrequire('@gmod/jbrowse-core/util')

  class Slice {
    flipped = false

    constructor(view, region, currentRadianOffset) {
      this.region = region
      this.offsetRadians = currentRadianOffset
      this.bpPerRadian = view.bpPerRadian

      this.startRadians = this.offsetRadians
      this.endRadians =
        (region.end - region.start) / this.bpPerRadian + this.offsetRadians
    }

    bpToXY(bp, radiusPx) {
      const offsetBp = this.flipped
        ? this.region.end - bp
        : bp - this.region.start
      const totalRadians = offsetBp / this.bpPerRadian + this.offsetRadians
      return polarToCartesian(radiusPx, totalRadians)
    }
  }

  return function calculateStaticSlices(self) {
    // TODO: calculate only slices that are visible
    const slices = []
    let currentRadianOffset = 0
    for (const region of self.displayedRegions) {
      slices.push(new Slice(self, region, currentRadianOffset))
      currentRadianOffset +=
        (region.end - region.start) / self.bpPerRadian +
        self.spacingPx / self.pxPerRadian
    }
    return slices
  }
}
