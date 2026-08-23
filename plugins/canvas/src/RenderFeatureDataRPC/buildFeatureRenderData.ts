import { collectRenderData } from './collectRenderData.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { laneShares } from './glyphs/isoformLanes.ts'
import { stacksMultipleIsoforms } from './glyphs/subfeatures.ts'
import { summarizeIsoformPicks } from './isoformPicks.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { FeatureDataResult } from './rpcTypes.ts'
import type {
  FeatureLayout,
  LaneShare,
  LayoutArgs,
  PeptideData,
} from './types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// One feature and the layout function dispatch picked for it, resolved once so
// the lane sweep and the layout pass share the answer.
interface GlyphChoice {
  feature: Feature
  glyph: (args: LayoutArgs) => FeatureLayout
}

// Every stacking gene's share of the lane, or nothing to divide. Skipped
// wholesale where no cap is in play — with `maxIsoforms` undefined the collapse
// never runs, and `longestCoding` leaves every gene one row however busy its
// lane is — so a track without the cap pays neither the sweep nor the spans it
// sweeps over.
function isoformLaneShares(choices: GlyphChoice[], config: DisplayConfig) {
  return config.maxIsoforms === undefined ||
    config.geneGlyphMode === 'longestCoding'
    ? new Map<string, LaneShare>()
    : laneShares(
        choices
          .filter(({ feature, glyph }) =>
            stacksMultipleIsoforms(feature, config, glyph),
          )
          .map(({ feature }) => ({
            featureId: feature.id(),
            startBp: feature.get('start'),
            endBp: feature.get('end'),
          })),
      )
}

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
  // Materialized because the isoform cap has to be divided among the genes that
  // stack together BEFORE any of them is laid out — one pass cannot both measure
  // the neighbourhood and spend it. Dispatch is resolved here rather than in the
  // loop below so the sweep, which needs to know which features are gene-level
  // stacks, does not run it a second time over every feature in the region.
  const choices: GlyphChoice[] = [...features].map(feature => ({
    feature,
    glyph: findGlyph(feature, config),
  }))
  const shares = isoformLaneShares(choices, config)
  const layouts: FeatureLayout[] = []
  for (const { feature, glyph } of choices) {
    report?.()
    layouts.push(
      glyph({
        feature,
        config,
        // for the one layout-time per-feature callback slot, `featureHeight`
        jexl,
        expandedGeneIds,
        laneShare: shares.get(feature.id()),
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
