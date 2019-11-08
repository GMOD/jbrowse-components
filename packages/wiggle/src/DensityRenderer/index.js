import {
  readConfObject,
  ConfigurationSchema,
} from '@gmod/jbrowse-core/configuration'
import { featureSpanPx } from '@gmod/jbrowse-core/util'
import { getScale } from '../util'

import ConfigSchema from '../configSchema'
import WiggleBaseRenderer from '../WiggleBaseRenderer'

export { default as ReactComponent } from '../WiggleRendering'

export default class extends WiggleBaseRenderer {
  draw(ctx, props) {
    const {
      features,
      region,
      bpPerPx,
      scaleOpts,
      height,
      config,
      horizontallyFlipped,
    } = props
    const pivot = readConfObject(config, 'bicolorPivot')
    const pivotValue = readConfObject(config, 'bicolorPivotValue')
    const negColor = readConfObject(config, 'negColor')
    const posColor = readConfObject(config, 'posColor')
    let colorCallback
    let colorScale
    if (readConfObject(config, 'color') === '#f0f') {
      // default color, use posColor/negColor instead
      colorScale =
        pivot !== 'none'
          ? getScale({
              ...scaleOpts,
              pivotValue,
              range: [negColor, 'white', posColor],
            })
          : getScale({ ...scaleOpts, range: ['white', posColor] })
      colorCallback = feature => colorScale(feature.get('score'))
    } else {
      colorCallback = feature => readConfObject(config, 'color', [feature])
    }

    for (const feature of features.values()) {
      const [leftPx, rightPx] = featureSpanPx(
        feature,
        region,
        bpPerPx,
        horizontallyFlipped,
      )
      const w = rightPx - leftPx + 0.3 // fudge factor for subpixel rendering
      ctx.fillStyle = colorCallback(feature)
      ctx.fillRect(leftPx, 0, w, height)
    }
  }
}
export const configSchema = ConfigurationSchema(
  'DensityRenderer',
  {},
  { baseConfiguration: ConfigSchema, explicitlyTyped: true },
)
