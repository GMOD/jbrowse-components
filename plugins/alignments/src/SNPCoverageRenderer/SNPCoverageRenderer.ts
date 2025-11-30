import { updateStatus } from '@jbrowse/core/util'
import { WiggleBaseRenderer } from '@jbrowse/plugin-wiggle'

import type { RenderArgsDeserializedWithFeatures } from './types'

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  async draw<T extends RenderArgsDeserializedWithFeatures>(
    ctx: CanvasRenderingContext2D,
    props: T,
  ) {
    const { statusCallback = () => {} } = props
    const { makeImage } = await import('./makeImage')
    return updateStatus('Rendering coverage', statusCallback, () =>
      makeImage(ctx, props),
    )
  }
}
