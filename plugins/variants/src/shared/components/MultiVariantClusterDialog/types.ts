import type { SampleInfo, Source } from '../../types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export interface ReducedModel {
  sourcesWithoutLayout?: Source[]
  sourcesVolatile?: Source[]
  minorAlleleFrequencyFilter?: number
  lengthCutoffFilter: number
  adapterConfig: AnyConfigurationModel
  renderingMode: string
  sampleInfo?: Record<string, SampleInfo>
  setClusterTree: (arg?: string) => void
  setLayout: (arg: Source[], clearTree?: boolean) => void
  clearLayout: () => void
}
