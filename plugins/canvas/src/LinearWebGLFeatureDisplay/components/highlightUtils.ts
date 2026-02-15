import { measureText } from '@jbrowse/core/util'

import type { FeatureLabelData } from '../../RenderWebGLFeatureDataRPC/rpcTypes.ts'

const FLOATING_LABEL_FONT_SIZE = 11

export function computeLabelExtraWidth(
  labelData: FeatureLabelData,
  featureWidthPx: number,
) {
  let extraWidth = 0
  for (const label of labelData.floatingLabels) {
    extraWidth = Math.max(
      extraWidth,
      measureText(label.text, FLOATING_LABEL_FONT_SIZE) - featureWidthPx,
    )
  }
  return extraWidth
}
