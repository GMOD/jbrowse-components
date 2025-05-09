import WiggleBaseRenderer from '../WiggleBaseRenderer'

import type { RenderArgsDeserializedWithFeatures } from '../WiggleBaseRenderer'

export default class DensityRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { drawDensity } = await import('../drawDensity')
    return drawDensity(ctx, props)
  }
}
