import type { CellHueRead } from '../shared/cellHue.ts'
import type { VariantUnit } from '../shared/constants.ts'
import type { Source } from '../shared/types.ts'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { GatedFetchArgs } from '@jbrowse/core/rpc/byteBudget'
import type { Region } from '@jbrowse/core/util'

interface BaseVariantRpcArgs {
  adapterConfig: Record<string, unknown>
  headers?: Record<string, string>
  regions: Region[]
  bpPerPx?: number
  minorAlleleFrequencyFilter: number
  // fraction of no-call genotypes above which a variant is hidden; 1 keeps all
  maxMissingnessFilter: number
  // jexl filters from the Edit filters dialog. On the wire this is a string[];
  // RpcMethodTypeWithFiltersAndRenameRegions rebuilds it into a chain in the
  // worker (and serializes the chain to string[] on the way out).
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
  // re-uploads instead of re-downloading the VCF. `undefined` means "every
  // sample the data has", which is the common case; an explicit list is a
  // row focus (`rows.kept`), which genuinely changes what has to be computed.
  // Mirrors maf's `subtreeFilter`.
  sampleFilter?: string[]
  unit: VariantUnit
  referenceDrawingMode?: string
  // What the alt cells' hue reads off each variant (`CellHue.read`).
  color?: CellHueRead
  // Which blocks the payloads are drawn by: one per displayed region at
  // genomic positions, one for the whole window in columns.
  layout: 'genomic' | 'columns'
  displayedRegionIndices?: number[]
}

export interface MultiSampleVariantGetSourcesArgs {
  adapterConfig: Record<string, unknown>
  headers?: Record<string, string>
  regions?: Region[]
  bpPerPx?: number
}
