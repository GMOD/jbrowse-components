import { maxLabelTextWidth } from '../../RenderFeatureDataRPC/rpcTypes.ts'

import type { FeatureLabelData } from '../../RenderFeatureDataRPC/rpcTypes.ts'

export function computeLabelExtraWidth(
  labelData: FeatureLabelData,
  featureWidthPx: number,
) {
  return Math.max(0, maxLabelTextWidth(labelData) - featureWidthPx)
}
