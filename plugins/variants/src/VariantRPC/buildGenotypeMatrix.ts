import { getGenotypeMatrix } from './getGenotypeMatrix.ts'
import { getPhasedGenotypeMatrix } from './getPhasedGenotypeMatrix.ts'

import type { Source } from '../shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type SerializableFilterChain from '@jbrowse/core/pluggableElementTypes/renderers/util/serializableFilterChain'
import type { Region, StatusCallback } from '@jbrowse/core/util'

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
    signal?: AbortSignal
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
    samplePloidy?: Record<string, number>
  }
}) {
  const { renderingMode, samplePloidy } = args
  return renderingMode === 'phased' && samplePloidy
    ? getPhasedGenotypeMatrix({
        pluginManager,
        args: { ...args, samplePloidy },
      })
    : getGenotypeMatrix({ pluginManager, args })
}
