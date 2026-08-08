import { getGenotypeMatrix } from './getGenotypeMatrix.ts'
import { getPhasedGenotypeMatrix } from './getPhasedGenotypeMatrix.ts'

import type { SampleInfo, Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type {
  LastStopTokenCheck,
  Region,
  StatusCallback,
} from '@jbrowse/core/util'

// The one place that decides which matrix a rendering mode wants: one row per
// haplotype in phased mode, one row per sample otherwise. Both the auto
// (WASM) and manual (R export) clustering paths go through here — when only the
// auto path branched, the manual dialog in phased mode built haplotype-labelled
// rows that each held the same per-sample dosage vector, so a sample's two
// haplotypes were identical by construction and the pasted order was a
// sample-level clustering wearing haplotype labels.
export async function buildGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: Record<string, unknown>
    stopTokenCheck?: LastStopTokenCheck
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    sources: Source[]
    bpPerPx?: number
    minorAlleleFrequencyFilter: number
    maxMissingnessFilter: number
    filters?: SerializableFilterChain
    statusCallback?: StatusCallback
    renderingMode?: string
    sampleInfo?: Record<string, SampleInfo>
  }
}) {
  const { renderingMode, sampleInfo } = args
  return renderingMode === 'phased' && sampleInfo
    ? getPhasedGenotypeMatrix({ pluginManager, args: { ...args, sampleInfo } })
    : getGenotypeMatrix({ pluginManager, args })
}
