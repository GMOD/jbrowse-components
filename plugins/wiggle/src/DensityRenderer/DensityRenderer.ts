import WiggleBaseRenderer from '../WiggleBaseRenderer'
import { drawDensity } from '../drawDensity'
import type { RenderArgsDeserializedWithFeatures } from '../WiggleBaseRenderer'

export default class DensityRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    return drawDensity(ctx, props)
  }
}
