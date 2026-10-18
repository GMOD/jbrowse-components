import SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import { isGeneLikeType } from '@jbrowse/core/util'

import { featureType } from './util.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'
import type { JexlInstance } from '@jbrowse/core/util/jexlStrings'

export type AdmissionConfig = Pick<
  DisplayConfig,
  'filter' | 'transcriptTypes' | 'containerTypes'
>

// Core's gene-like rule keeps an Ensembl `ncRNA_gene` or a bare `tRNA`; the
// configured types and a prokaryote's top-level CDS join it. `filter.genes`
// tests by it, and these names claim the fit height first.
export function geneTypeTest(
  config: Pick<DisplayConfig, 'transcriptTypes' | 'containerTypes'>,
) {
  const geneTypes = new Set(
    [...config.transcriptTypes, ...config.containerTypes, 'CDS'].map(t =>
      t.toLowerCase(),
    ),
  )
  return (type: string) =>
    isGeneLikeType(type) || geneTypes.has(type.toLowerCase())
}

// NCBI RefSeq emits one type=region feature per molecule spanning the whole
// sequence, which carries only taxon metadata and draws as a bar across every
// window. `gbkey=Src` marks it far more tightly than type=region does, so CpG
// islands and centromeres pass, as does every file with no gbkey attribute.
function isSourceRecord(feature: Feature) {
  return feature.get('gbkey') === 'Src'
}

// The single place that decides which fetched features get laid out and drawn.
// It binds the worker's plugin jexl instance so a filter can call a
// plugin-registered function.
export function buildFeatureAdmission({
  config,
  jexl,
  soloFeatureIds,
  hiddenFeatureIds,
}: {
  config: AdmissionConfig
  jexl: JexlInstance
  soloFeatureIds?: string[]
  hiddenFeatureIds?: string[]
}) {
  const { expressions, genes } = config.filter
  const filterChain = new SerializableFilterChain({
    filters: expressions,
    jexl,
  })

  const isGeneType = genes ? geneTypeTest(config) : undefined
  const passesGeneGate = (feature: Feature) => {
    if (!isGeneType) {
      return true
    }
    const isGene = isGeneType(featureType(feature))
    return genes === 'only' ? isGene : !isGene
  }

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

  // Cheapest gate first, so the expensive jexl filterChain only runs on
  // features the membership and type gates already admit.
  return (feature: Feature) => {
    const id = feature.id()
    return (
      (soloSet === undefined || soloSet.has(id)) &&
      !hiddenSet?.has(id) &&
      !isSourceRecord(feature) &&
      passesGeneGate(feature) &&
      filterChain.passes(feature)
    )
  }
}
