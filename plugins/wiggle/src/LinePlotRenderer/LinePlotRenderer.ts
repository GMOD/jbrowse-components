import WiggleBaseRenderer, {
  RenderArgsDeserializedWithFeatures,
} from '../WiggleBaseRenderer'

import { YSCALEBAR_LABEL_OFFSET } from '../util'
import { drawLine } from '../drawLine'

export default class LinePlotRenderer extends WiggleBaseRenderer {
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    return drawLine(ctx, {
      ...props,
      colorCallback: () => 'grey',
      offset: YSCALEBAR_LABEL_OFFSET,
    })
  }
}
