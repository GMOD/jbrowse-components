import type {
  FeatureDataResult,
  FeatureLabelData,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { MultiBedRenderResult } from '../RenderMultiBedDataRPC/rpcTypes.ts'

export interface LaneLayoutInputs {
  laneIndexByKey: ReadonlyMap<string, number>
  laneHeight: number
  laneGap: number
}

// Assigns Y per-feature based on its lane key (looked up in the ordered
// `laneIndexByKey` map). Features whose lane is unknown (key not in map) are
// skipped via the OFFSCREEN_Y offset, matching the canvas layout's overflow
// convention.
const OFFSCREEN_Y = -1e6

export function computeLaneLaidOutData(
  rpcDataMap: ReadonlyMap<number, MultiBedRenderResult>,
  inputs: LaneLayoutInputs,
): Map<number, FeatureDataResult> {
  const { laneIndexByKey, laneHeight, laneGap } = inputs
  const stride = laneHeight + laneGap

  const out = new Map<number, MultiBedRenderResult>()
  for (const [n, raw] of rpcDataMap) {
    out.set(n, raw.flatbushItems.length > 0 ? cloneMutableFields(raw) : raw)
  }

  for (const [, data] of out) {
    if (data.flatbushItems.length === 0) {
      continue
    }
    const { laneKeys } = data
    const featureOffsets = new Float32Array(data.flatbushItems.length)
    for (let i = 0; i < data.flatbushItems.length; i++) {
      const key = laneKeys[i] ?? ''
      const idx = laneIndexByKey.get(key)
      featureOffsets[i] = idx === undefined ? OFFSCREEN_Y : idx * stride
    }

    for (let i = 0; i < data.rectYs.length; i++) {
      data.rectYs[i] =
        data.rectYs[i]! + featureOffsets[data.rectFeatureIndices[i]!]!
    }

    for (let i = 0; i < data.flatbushItems.length; i++) {
      const item = data.flatbushItems[i]!
      const offset = featureOffsets[i]!
      item.topPx = offset
      item.bottomPx = offset + laneHeight
    }
  }

  return out
}

function cloneMutableFields(raw: MultiBedRenderResult): MultiBedRenderResult {
  const floatingLabelsData: Record<string, FeatureLabelData> = {}
  for (const [k, v] of Object.entries(raw.floatingLabelsData)) {
    floatingLabelsData[k] = { ...v }
  }
  return {
    ...raw,
    rectYs: new Float32Array(raw.rectYs),
    lineYs: new Float32Array(raw.lineYs),
    arrowYs: new Float32Array(raw.arrowYs),
    flatbushItems: raw.flatbushItems.map(item => ({ ...item })),
    subfeatureInfos: raw.subfeatureInfos.map(info => ({ ...info })),
    floatingLabelsData,
  }
}
