import { readConfObject } from '@jbrowse/core/configuration'
import { featureSpanPx } from '@jbrowse/core/util'
import { Feature } from '@jbrowse/core/util/simpleFeature'
import { getScale } from '../util'

import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

export default class DensityRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { features, regions, bpPerPx, scaleOpts, height, config } = props
    const [region] = regions
    const pivot = readConfObject(config, 'bicolorPivot')
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    const color = readConfObject(config, 'color')
    let colorCallback
    if (color === '#f0f') {
      const colorScale =
        pivot !== 'none'
          ? getScale({
              ...scaleOpts,
              pivotValue,
              range: [negColor, 'white', posColor],
            })
          : getScale({ ...scaleOpts, range: ['white', posColor] })
      colorCallback = (feature: Feature) => colorScale(feature.get('score'))
    } else {
      colorCallback = (feature: Feature) =>
        readConfObject(config, 'color', { feature })
    }

    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(feature, region, bpPerPx)
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      ctx.fillStyle = colorCallback(feature)
      ctx.fillRect(leftPx, 0, w, height)
    }
  }
}
