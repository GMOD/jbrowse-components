import type { FeatureLabelData } from '../../RenderWebGLFeatureDataRPC/rpcTypes.ts'

export function computeLabelExtraWidth(
  labelData: FeatureLabelData,
  featureWidthPx: number,
) {
  let extraWidth = 0
  for (const label of labelData.floatingLabels) {
    extraWidth = Math.max(extraWidth, label.textWidth - featureWidthPx)
  }
  return extraWidth
}
