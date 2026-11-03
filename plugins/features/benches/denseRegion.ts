import { LITERAL } from '../src/RenderFeatureDataRPC/colorClasses.ts'
import { createFeatureFloatingLabels } from '../src/RenderFeatureDataRPC/floatingLabels.ts'
import { packRenderArrays } from '../src/RenderFeatureDataRPC/packRenderArrays.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
  makeSubfeatureInfo,
} from '../src/RenderFeatureDataRPC/testUtils.ts'

import type {
  LineData,
  RectData,
} from '../src/RenderFeatureDataRPC/packRenderArrays.ts'
import type { FeatureLabelData } from '../src/RenderFeatureDataRPC/rpcTypes.ts'

export const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )

const FEATURE_BP = 16_000
const SPACING_BP = 20_000

// A named gene track as the worker ships it: one mRNA per feature with
// `exons` CDS boxes, features overlapping nothing but the labels.
export function makeDenseRegion(name: string, features: number, exons: number) {
  const rects: RectData[] = []
  const lines: LineData[] = []
  const flatbushItems = []
  const subfeatureInfos = []
  const floatingLabelsData = new Map<string, FeatureLabelData>()
  for (let i = 0; i < features; i++) {
    const featureId = `${name}g${i}`
    const mrnaId = `${featureId}.t`
    const start = i * SPACING_BP
    const end = start + FEATURE_BP
    flatbushItems.push(
      makeFlatbushItem({
        featureId,
        startBp: start,
        endBp: end,
        name: featureId,
      }),
    )
    floatingLabelsData.set(featureId, {
      featureId,
      minX: start,
      maxX: end,
      topY: 0,
      featureHeight: 10,
      ...createFeatureFloatingLabels({
        name: featureId,
        description: undefined,
      }),
    })
    subfeatureInfos.push(
      makeSubfeatureInfo({
        featureId: mrnaId,
        parentFeatureId: featureId,
        childOrdinal: 0,
      }),
    )
    lines.push({
      start,
      end,
      direction: 1,
      y: 0,
      flatbushIdx: i,
      labelRowsAbove: 0,
      colorClass: LITERAL,
      color: 0xff,
      childOrdinal: 0,
    })
    for (let e = 0; e < exons; e++) {
      subfeatureInfos.push(
        makeSubfeatureInfo({
          featureId: `${mrnaId}.e${e}`,
          parentFeatureId: mrnaId,
          type: 'CDS',
          childOrdinal: e + 1,
        }),
      )
      rects.push({
        start: start + e * 2000,
        end: start + e * 2000 + 900,
        y: 0,
        height: 10,
        strand: 1,
        flatbushIdx: i,
        labelRowsAbove: 0,
        colorClass: LITERAL,
        color: 0xff,
        childOrdinal: e + 1,
      })
    }
  }
  return makeFeatureData({
    ...packRenderArrays(rects, lines, [], 0, Number.MAX_SAFE_INTEGER),
    flatbushItems,
    subfeatureInfos,
    floatingLabelsData,
    featureCount: features,
    labelKinds: { name: true, description: false, subfeature: false },
  })
}
