import { fieldReader } from '@jbrowse/core/util/fieldReader'

import { createColorKey } from './collect/colorKey.ts'
import { tooltipReader } from './collect/glyphColors.ts'
import { processFeatureRecord } from './collect/glyphEmitters.ts'
import { createCollector } from './collect/renderContext.ts'
import { geneTypeTest } from './featureAdmission.ts'
import { labelKindsOf } from './floatingLabels.ts'
import { packRenderArrays } from './packRenderArrays.ts'

import type { ColorKey } from './collect/colorKey.ts'
import type { RenderContext } from './collect/renderContext.ts'
import type { FeatureLayout } from './types.ts'

function colorValuesOf(key: ColorKey | undefined) {
  return (
    key && {
      field: key.field,
      values: key.values,
      painted: key.painted,
      rows: key.rows,
    }
  )
}

// Walks the per-feature layout tree, emits draw primitives and hit/label
// metadata into a Collector, then packs the visible window into the typed
// arrays the renderers consume. Geometry stays in absolute genomic uint32:
// packRenderArrays filters to [regionStart, regionEnd) without rebasing.
export function collectRenderData(
  args: RenderContext & {
    layouts: FeatureLayout[]
    regionStart: number
    regionEnd: number
  },
) {
  const { layouts, regionStart, regionEnd, config, jexl, transcriptFeatures } =
    args
  const collector = createCollector(
    createColorKey(config.color.field, jexl),
    transcriptFeatures && createColorKey(transcriptFeatures.color.field, jexl),
  )
  const ctx = {
    ...args,
    readGroupKey:
      config.facetField === undefined
        ? undefined
        : fieldReader(config.facetField, jexl),
    isGeneType: geneTypeTest(config),
    tooltipOf: tooltipReader(config, jexl),
  }

  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }

  const packed = packRenderArrays(
    collector.rects,
    collector.lines,
    collector.arrows,
    regionStart,
    regionEnd,
    collector.flatbushItems,
  )

  return {
    ...packed,
    labelKinds: labelKindsOf(collector.floatingLabelsData),
    floatingLabelsData: collector.floatingLabelsData,
    flatbushItems: collector.flatbushItems,
    subfeatureInfos: collector.subfeatureInfos,
    colorValues: colorValuesOf(collector.colorKey),
    domainColorValues: colorValuesOf(collector.domainColorKey),
    aminoAcidOverlay:
      collector.aminoAcidOverlay.length > 0
        ? collector.aminoAcidOverlay
        : undefined,
  }
}
