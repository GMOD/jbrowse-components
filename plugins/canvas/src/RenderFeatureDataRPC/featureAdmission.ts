import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { ensureJexlPrefix } from '@jbrowse/core/util/jexlStrings'

import { featureType } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

// The single place that decides which fetched features get laid out and drawn.
// The `jexlFilters` slot stores expressions without the `jexl:` prefix, so this
// adds it before compiling, and binds the worker's plugin jexl instance so a
// filter can call a plugin-registered function.
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

  // A runtime display mode rather than a config jexl filter, but applied at the
  // same admission stage so "what gets drawn" has one answer.
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

  // An exact uniqueId-membership match; an empty or absent set admits
  // everything.
  const soloSet =
    soloFeatureIds && soloFeatureIds.length > 0
      ? new Set(soloFeatureIds)
      : undefined
  const hiddenSet =
    hiddenFeatureIds && hiddenFeatureIds.length > 0
      ? new Set(hiddenFeatureIds)
      : undefined

  // NCBI RefSeq emits one type=region feature per molecule spanning the whole
  // sequence, so it draws as a bar across every window at every zoom. `gbkey=Src`
  // is a far tighter marker than type=region, so this leaves CpG islands and
  // centromeres alone and a file with no gbkey attribute passes untouched. A
  // gate rather than a jexlFilters default, which would seed the "Filter by..."
  // dialog with an expression the user never wrote.
  const hideSource = config.hideSourceFeatures

  // Cheapest gate first, so the expensive jexl filterChain only runs on
  // features the membership and type gates already admit.
  return (feature: Feature) => {
    const id = feature.id()
    return (
      (soloSet === undefined || soloSet.has(id)) &&
      !hiddenSet?.has(id) &&
      (!hideSource || feature.get('gbkey') !== 'Src') &&
      (geneLikeTypes === undefined ||
        geneLikeTypes.has(featureType(feature).toLowerCase())) &&
      filterChain.passes(feature)
    )
  }
}
