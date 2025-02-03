import { WiggleBaseRenderer } from '@jbrowse/plugin-wiggle'

import type { RenderArgsDeserializedWithFeatures } from './types'
import { updateStatus } from '@jbrowse/core/util'

export default class SNPCoverageRenderer extends WiggleBaseRenderer {
  // note: the snps are drawn on linear scale even if the data is drawn in log
  // scape hence the two different scales being used
  // @ts-expect-error
  async draw(
    ctx: CanvasRenderingContext2D,
    props: RenderArgsDeserializedWithFeatures,
  ) {
    const { statusCallback = () => {} } = props
    const { makeImage } = await import('./makeImage')
    await updateStatus('Rendering coverage', statusCallback, () =>
      makeImage(ctx, props),
    )
    return undefined
  }
}
