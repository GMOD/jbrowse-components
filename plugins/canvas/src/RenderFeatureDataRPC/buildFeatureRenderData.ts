import { collectRenderData } from './collectRenderData.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { summarizeIsoformPicks } from './isoformPicks.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureDataResult } from './rpcTypes.ts'
import type { FeatureLayout, PeptideData } from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

/**
 * Features in, render data out. Takes an iterable rather than an adapter
 * because the fetch is not the only way to come by features: the multi-sample
 * variant display's lane arrives holding records it has already parsed, and
 * builds its band through this rather than re-reading the same VCF.
 *
 * The peptide overlay needs a sequence adapter, which a non-RPC caller has no
 * way to supply, so it is optional.
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
  // Stated rather than counted off `features`, which is only an iterable.
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
