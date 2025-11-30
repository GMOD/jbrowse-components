import { updateStatus } from '@jbrowse/core/util'
import {
  WiggleBaseRenderer,
  type RenderArgsDeserializedWithFeatures as WiggleRenderArgs,
} from '@jbrowse/plugin-wiggle'

import type { RenderArgsDeserializedWithFeatures } from './types'

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  async draw<T extends WiggleRenderArgs>(ctx: CanvasRenderingContext2D, props: T) {
    const p = props as unknown as RenderArgsDeserializedWithFeatures
    const { statusCallback = () => {} } = p
    const { makeImage } = await import('./makeImage')
    return updateStatus('Rendering coverage', statusCallback, () =>
      makeImage(ctx, p),
    )
  }
}
