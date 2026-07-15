import type { SampleInfo, Source } from '../../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'

export interface ReducedModel {
  layout: Source[]
  sourcesWithoutLayout?: Source[]
  sourcesVolatile?: Source[]
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
