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

  // The GFF3 source record: NCBI RefSeq emits one type=region feature per
  // molecule spanning the whole sequence (taxon/strain/mol_type metadata), so
  // it draws as a bar across every window at every zoom. `gbkey=Src` is the
  // GenBank source feature key and a far tighter marker than type=region, so
  // this leaves other region features (CpG islands, centromeres, ...) alone,
  // and a file with no gbkey attribute passes untouched.
  //
  // A GATE rather than a jexlFilters default, which is where it used to live:
  // that slot seeds the "Filter by..." dialog, so the rule met every user of
  // every track as a jexl expression they had not written and could not read.
  // `hideSourceFeatures` is how to turn it off.
  const hideSource = config.hideSourceFeatures

  // Gates ordered cheapest-first so the expensive jexl filterChain only runs on
  // features the membership/type gates already admit — matters at whole-genome
  // showOnlyGenes zoom, where most features are dropped by type.
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
