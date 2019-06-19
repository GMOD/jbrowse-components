export default ({ jbrequire }) => {
  const { polarToCartesian, radToDeg } = jbrequire('@gmod/jbrowse-core/util')

  const canvasPaddingPx = 5

  class Slice {
    constructor(view, region, currentBpOffset, spacingOffsetDistance) {
      const { radiusPx, totalBp, bpPerRadian } = view
      const spanBp = region.end - region.start
      const spanRadians = spanBp / bpPerRadian

      this.region = region
      this.radiusPx = radiusPx // for now, slices have the same radius as the overall figure

      // calculate the offset of the slice's origin from the figure origin
      const spacingOffsetTheta =
        ((currentBpOffset + spanBp / 2) / totalBp) * 2 * Math.PI
      const spacingOffset = {
        theta: spacingOffsetTheta,
        thetaDegrees: radToDeg(spacingOffsetTheta),
        rho: spacingOffsetDistance,
      }
      ;[spacingOffset.x, spacingOffset.y] = polarToCartesian(
        spacingOffset.rho,
        spacingOffset.theta,
      )
      this.spacingOffset = spacingOffset

      // calculate params of the drawing canvas: coordinate translation, height, width.
      // Note: the slice coordinate origin is not always at the upper left of the bounding box
      if (spanRadians < Math.PI / 2) {
        this.canvas = {
          widthPx: radiusPx + 2 * canvasPaddingPx,
          heightPx: radiusPx * Math.sin(spanRadians) + 2 * canvasPaddingPx,
          originX: canvasPaddingPx,
          originY: canvasPaddingPx,
        }
      } else if (spanRadians < Math.PI) {
        this.canvas = {
          widthPx: radiusPx * (1 - Math.cos(spanRadians)) + 2 * canvasPaddingPx,
          heightPx: radiusPx + 2 * canvasPaddingPx,
          originX: -radiusPx * Math.cos(spanRadians) + canvasPaddingPx,
          originY: canvasPaddingPx,
        }
      } else if (spanRadians < 1.5 * Math.PI) {
        this.canvas = {
          widthPx: 2 * (radiusPx + canvasPaddingPx),
          heightPx:
            radiusPx * (1 - Math.sin(spanRadians)) + 2 * canvasPaddingPx,
          originX: radiusPx + canvasPaddingPx,
          originY: -radiusPx * Math.sin(spanRadians) + canvasPaddingPx,
        }
      } else {
        this.canvas = {
          widthPx: 2 * (radiusPx + canvasPaddingPx),
          heightPx: 2 * (radiusPx + canvasPaddingPx),
          originX: radiusPx + canvasPaddingPx,
          originY: radiusPx + canvasPaddingPx,
        }
      }

      this.canvas.rotation = (currentBpOffset / totalBp) * 2 * Math.PI
    }
  }

  return function calculateStaticSlices(self) {
    // TODO: calculate only slices that are visible
    const slices = []
    const numRegions = self.displayedRegions.length
    const spacingOffsetDistance =
      numRegions <= 1
        ? 0
        : self.spacingPx / (2 * Math.cos(Math.PI / 2 / numRegions))
    let currentBpOffset = 0
    for (const region of self.displayedRegions) {
      slices.push(new Slice(self, region, currentBpOffset, spacingOffsetDistance))
      currentBpOffset += region.end - region.start
    }
    return slices
  }
}
