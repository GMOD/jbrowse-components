import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'

import { featureType } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// The canvas worker's feature-admission stage: the single place that decides
// which fetched features get laid out and drawn. Every other JBrowse render
// path runs features through a SerializableFilterChain built from the
// `jexlFilters` config slot; this restores that boundary for the GPU display.
//
// The slot stores expressions WITHOUT the `jexl:` prefix (deferred-evaluation
// convention), so we add it before compiling, and bind the worker's plugin jexl
// instance so a filter can call a plugin-registered function.
export function buildFeatureAdmission({
  config,
  jexl,
  showOnlyGenes,
  soloFeatureIds,
  hiddenFeatureIds,
}: {
  config: DisplayConfig
  jexl: JexlInstance
  showOnlyGenes?: boolean
  soloFeatureIds?: string[]
  hiddenFeatureIds?: string[]
}) {
  const filterChain = new SerializableFilterChain({
    filters: config.jexlFilters.map(ensureJexlPrefix),
    jexl,
  })

  // showOnlyGenes is the reduced-representation gene view's type gate; kept as a
  // distinct predicate (a runtime display mode, not a config jexl filter) but
  // applied at the same admission stage so "what gets drawn" has one answer.
  const geneLikeTypes = showOnlyGenes
    ? new Set(
        [
          ...config.transcriptTypes,
          ...config.containerTypes,
          'gene',
          'pseudogene',
          'CDS',
        ].map(t => t.toLowerCase()),
      )
    : undefined

  // "Show only these features": an exact uniqueId-membership match, applied at
  // the same admission stage as the type/jexl gates so "what gets drawn" has
  // one answer. An empty/absent set admits everything.
  const soloSet =
    soloFeatureIds && soloFeatureIds.length > 0
      ? new Set(soloFeatureIds)
      : undefined
  const hiddenSet =
    hiddenFeatureIds && hiddenFeatureIds.length > 0
      ? new Set(hiddenFeatureIds)
      : undefined
  return (feature: Feature) =>
    (soloSet === undefined || soloSet.has(feature.id())) &&
    !hiddenSet?.has(feature.id()) &&
    filterChain.passes(feature) &&
    (geneLikeTypes === undefined ||
      geneLikeTypes.has(featureType(feature).toLowerCase()))
}
