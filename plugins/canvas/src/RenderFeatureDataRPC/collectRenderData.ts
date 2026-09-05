import { resolveOutlineColor } from './collect/glyphColors.ts'
import { processFeatureRecord } from './collect/glyphEmitters.ts'
import { createCollector } from './collect/renderContext.ts'
import { packRenderArrays } from './packRenderArrays.ts'

import type { RenderContext } from './collect/renderContext.ts'
import type { FeatureLayout } from './types.ts'

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
  const { layouts, regionStart, regionEnd, config } = args
  const collector = createCollector()

  const outline = resolveOutlineColor(config.outlineColor)

  for (const layout of layouts) {
    processFeatureRecord(layout, args, collector)
  }

  const packed = packRenderArrays(
    collector.rects,
    collector.lines,
    collector.arrows,
    regionStart,
    regionEnd,
  )

  const labelKinds = { name: false, description: false, subfeature: false }
  for (const labelData of collector.floatingLabelsData.values()) {
    labelKinds.name ||= !!labelData.nameLabel
    labelKinds.description ||= !!labelData.descriptionLabel
    labelKinds.subfeature ||= !!labelData.subfeatureLabel
  }

  return {
    ...packed,
    ...outline,
    labelKinds,
    floatingLabelsData: collector.floatingLabelsData,
    flatbushItems: collector.flatbushItems,
    subfeatureInfos: collector.subfeatureInfos,
    aminoAcidOverlay:
      collector.aminoAcidOverlay.length > 0
        ? collector.aminoAcidOverlay
        : undefined,
  }
}
