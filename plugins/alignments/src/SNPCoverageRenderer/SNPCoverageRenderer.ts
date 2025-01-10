import { WiggleBaseRenderer } from '@jbrowse/plugin-wiggle'

import type { RenderArgsDeserializedWithFeatures } from './types'

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { makeImage } = await import('./makeImage')
    await makeImage(ctx, props)
    return undefined
  }
}
