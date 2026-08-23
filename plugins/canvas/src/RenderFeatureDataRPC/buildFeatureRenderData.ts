import { collectRenderData } from './collectRenderData.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { summarizeIsoformPicks } from './isoformPicks.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureDataResult } from './rpcTypes.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * Features in, render data out — the whole of this RPC method that is not
 * fetching, gating or progress reporting.
 *
 * Pure, and takes an iterable of features rather than an adapter, because the
 * fetch is not the only way to come by features. The multi-sample variant
 * display's lane arrives here holding records it has *already* parsed (its own
 * worker read every genotype off them), so it builds its band's render data
 * through this instead of asking the adapter for the same VCF a second time. It
 * is the same reason the two halves of this file are split at all: everything
 * after `features` is arithmetic over plain data.
 *
 * `report` is called once per feature so a caller that shows determinate
 * progress can; the RPC passes its `withProgress` reporter, the lane passes
 * nothing.
 *
 * The peptide overlay is the one input a non-RPC caller has no way to supply
 * (it needs a sequence adapter), and it is optional for that reason.
 */
export function buildFeatureRenderData({
  features,
  featureCount,
  config,
  jexl,
  regionStart,
  regionEnd,
  colorByCDS = false,
  expandedGeneIds,
  peptideDataMap,
  report,
}: {
  features: Iterable<Feature>
  // Stated rather than counted off `features`, which is only an iterable — and
  // the RPC's count is its deduped map's size, the same number its density gate
  // decided on.
  featureCount: number
  config: DisplayConfig
  jexl: JexlInstance
  regionStart: number
  regionEnd: number
  colorByCDS?: boolean
  expandedGeneIds?: ReadonlySet<string>
  peptideDataMap?: Map<string, PeptideData>
  report?: () => void
}): FeatureDataResult {
  const layouts: FeatureLayout[] = []
  for (const feature of features) {
    report?.()
    layouts.push(
      findGlyph(
        feature,
        config,
      )({
        feature,
        config,
        // for the one layout-time per-feature callback slot, `featureHeight`
        jexl,
        expandedGeneIds,
      }),
    )
  }
  const packed = collectRenderData({
    layouts,
    regionStart,
    regionEnd,
    config,
    colorByCDS,
    peptideDataMap,
    jexl,
  })
  return {
    ...packed,
    featureCount,
    hasMultiIsoformGenes: layouts.some(layout => layout.hasMultipleIsoforms),
    isoformPicks: summarizeIsoformPicks(layouts),
  }
}
