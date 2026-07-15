import { resolveOutlineColor } from './collect/glyphColors.ts'
import { processFeatureRecord } from './collect/glyphEmitters.ts'
import { createCollector } from './collect/renderContext.ts'
import { packRenderArrays } from './packRenderArrays.ts'

import type { RenderContext } from './collect/renderContext.ts'
import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
import type { JBrowseTheme as Theme } from '@jbrowse/core/ui'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// Walks the per-feature layout tree, emits draw primitives + hit/label metadata
// into a Collector (see collect/), then packs the visible window into the typed
// arrays the GPU/Canvas2D renderers consume. Geometry stays in absolute genomic
// uint32 — packRenderArrays filters to [regionStart, regionEnd) without
// rebasing.
export function collectRenderData(
  layouts: FeatureLayout[],
  regionStart: number,
  regionEnd: number,
  config: DisplayConfig,
  theme: Theme,
  colorByCDS: boolean,
  peptideDataMap: Map<string, PeptideData> | undefined,
  jexl: JexlInstance,
) {
  const ctx: RenderContext = {
    config,
    theme,
    colorByCDS,
    peptideDataMap,
    jexl,
  }

  const collector = createCollector()

  const outlineColor = resolveOutlineColor(config.outlineColor, theme)

  for (const layout of layouts) {
    processFeatureRecord(layout, ctx, collector)
  }

  const packed = packRenderArrays(
    collector.rects,
    collector.lines,
    collector.arrows,
    regionStart,
    regionEnd,
  )

  return {
    ...packed,
    outlineColor,
    floatingLabelsData: collector.floatingLabelsData,
    flatbushItems: collector.flatbushItems,
    subfeatureInfos: collector.subfeatureInfos,
    aminoAcidOverlay:
      collector.aminoAcidOverlay.length > 0
        ? collector.aminoAcidOverlay
        : undefined,
  }
}
