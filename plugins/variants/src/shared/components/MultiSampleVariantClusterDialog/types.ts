import type { ProcessedSource, SampleInfo, Source } from '../../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'

export interface ReducedModel {
  layout: Source[]
  sourcesWithoutLayout?: Source[]
  sourcesVolatile?: Source[]
  // The rows the display is showing: layout-ordered and subtree-filtered, and
  // already haplotype-expanded once a phased clustering has written `layout`.
  // What both clustering paths cluster, so a re-run inside a filtered clade
  // resolves that clade rather than the whole cohort.
  sourcesBase?: ProcessedSource[]
  minorAlleleFrequencyFilter?: number
  maxMissingnessFilter?: number
  filters?: SerializableFilterChain
  adapterConfig: AnyConfigurationModel
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
  setClusterTree: (arg?: string) => void
  setLayout: (arg: Source[]) => void
  setLayoutAndPendingClusterTree: (layout: Source[], tree: string) => void
  clearLayout: () => void
}
