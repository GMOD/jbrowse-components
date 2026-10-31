import type { CellHueRead } from '../shared/cellHue.ts'
import type { VariantUnit } from '../shared/constants.ts'
import type { Source } from '../shared/types.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { GatedFetchArgs } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

interface BaseVariantRpcArgs {
  adapterConfig: Record<string, unknown>
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx?: number
  // the display filter's site fields, `minorAlleleFrequency` and
  // `missingness`, compiled over each site's allele summary
  siteFilter: FieldPredicate[]
  // the display filter's other entries, a feature's own fields and `jexl:`
  // tests. RpcMethodTypeWithFiltersAndRenameRegions rebuilds the list into a
  // chain in the worker (and serializes the chain to the list on the way out).
  filters?: SerializableFilterChain
}

export interface GetGenotypeMatrixArgs extends BaseVariantRpcArgs {
  sources: Source[]
  // Which matrix to build: 'haplotype' means one row per haplotype, which
  // needs `samplePloidy`. Unset means one row per sample.
  unit?: VariantUnit
  samplePloidy?: Record<string, number>
}

// What gets fetched is `GetGenotypeMatrixArgs` exactly; `partition` names the
// rows of each band, which cluster apart (`clusterMatrix`).
export interface ClusterGenotypeMatrixArgs extends GetGenotypeMatrixArgs {
  partition?: string[][]
}

export interface GetCellDataArgs extends BaseVariantRpcArgs, GatedFetchArgs {
  // Which samples get rows, as a SET — never an order. The worker builds its own
  // canonical row list (see `buildCanonicalRows`), names it in `rowNames`, and
  // the client places those names against the rows it draws. Sent sorted so a
  // reorder, a regroup, or a clustering run leaves the cache key untouched and
  // re-uploads instead of re-downloading the VCF. The display sends the
  // adapter's samples under its focus (`sourcesBase`), every one of them
  // while no focus is set, already resolved from haplotype rows to sample
  // names; `undefined` is the sample listing not landed yet. Not MAF's
  // `rowFocus`, which is the raw focus the worker resolves.
  sampleFilter?: string[]
  unit: VariantUnit
  referenceDrawingMode?: string
  // What the alt cells' hue reads off each variant (`CellHue.read`).
  color?: CellHueRead
  // Which blocks the payloads are drawn by: one per displayed region at
  // genomic positions, one for the whole window in columns.
  layout: 'genomic' | 'columns'
  displayedRegionIndices?: number[]
  // The density budget at `bpPerPx`, sent only while the display's density
  // gate may act (no genotype rows). Not in `rpcProps()`, so no cache key.
  maxFeatureDensity?: number
}

export interface MultiSampleVariantGetSourcesArgs {
  adapterConfig: Record<string, unknown>
  headers?: Record<string, string>
  regions?: Region[]
  bpPerPx?: number
}
