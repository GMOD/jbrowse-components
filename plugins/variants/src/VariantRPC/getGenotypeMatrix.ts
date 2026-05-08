import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { checkStopToken2 } from '@jbrowse/core/util/stopToken'
import { firstValueFrom, toArray } from 'rxjs'

import { getFeaturesThatPassMinorAlleleFrequencyFilter } from '../shared/minorAlleleFrequencyUtils.ts'
import { classifyGenotypeDosage } from '../shared/parseGenotypeDosage.ts'
import {
  detectRawMode,
  encodeGenotypeFromRaw,
  getRawCallGenotype,
} from '../shared/rawGenotypes.ts'

import type { Source } from '../shared/types.ts'
import type { GenotypeCallback } from '@gmod/vcf'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, LastStopTokenCheck, Region } from '@jbrowse/core/util'

interface VCFFeatureLike extends Feature {
  processGenotypes(cb: GenotypeCallback): void
}

function hasProcessGenotypes(f: Feature): f is VCFFeatureLike {
  return typeof (f as Partial<VCFFeatureLike>).processGenotypes === 'function'
}

export async function getGenotypeMatrix({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: {
    adapterConfig: AnyConfigurationModel
    stopTokenCheck?: LastStopTokenCheck
    sessionId: string
    headers?: Record<string, string>
    regions: Region[]
    sources: Source[]
    bpPerPx?: number
    minorAlleleFrequencyFilter: number
    lengthCutoffFilter: number
    statusCallback?: (arg: string) => void
  }
}) {
  const {
    sources,
    minorAlleleFrequencyFilter,
    regions,
    adapterConfig,
    sessionId,
    lengthCutoffFilter,
    stopTokenCheck,
    statusCallback,
  } = args
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const rows: Record<string, number[]> = {}
  // Hoist sample-key resolution out of the per-feature loop. Per (source ×
  // feature) the previous code recomputed `sampleName ?? name` and (in the
  // raw branch) `sampleIndexMap.get(...)`; both are constant per source.
  const resolved = sources.map(s => ({
    name: s.name,
    key: s.sampleName ?? s.name,
    rawIdx: -1,
  }))
  for (const r of resolved) {
    rows[r.name] = []
  }

  const mafs = getFeaturesThatPassMinorAlleleFrequencyFilter({
    minorAlleleFrequencyFilter,
    lengthCutoffFilter,
    stopTokenCheck,
    features: await updateStatus('Loading features', statusCallback, () =>
      firstValueFrom(
        dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
    ),
  })
  const raw = detectRawMode(mafs)
  if (raw) {
    for (const r of resolved) {
      const idx = raw.sampleIndexMap.get(r.key)
      r.rawIdx = idx ?? -1
    }
  }

  // Set up the allocation-free non-raw path: per feature, iterate genotypes
  // via processGenotypes (no Record / no substring slices) into a reusable
  // dosage buffer indexed by sample-array position. Falls back to the
  // genotypes-Record path if features don't support processGenotypes.
  const sampleNames =
    mafs.length > 0
      ? ((mafs[0]!.feature.get('sampleNames') as string[] | undefined) ?? [])
      : []
  const samplesLen = sampleNames.length
  const sampleIdxByKey = new Map<string, number>()
  for (let i = 0; i < samplesLen; i++) {
    sampleIdxByKey.set(sampleNames[i]!, i)
  }
  const used = new Uint8Array(samplesLen)
  const dosages = new Int8Array(samplesLen)
  const resolvedSampleIdx = resolved.map(r => {
    const idx = sampleIdxByKey.get(r.key) ?? -1
    if (idx !== -1) {
      used[idx] = 1
    }
    return idx
  })

  for (const { feature } of mafs) {
    const callGt = getRawCallGenotype(feature)
    if (callGt && raw) {
      const ploidy = feature.get('ploidy') as number
      for (const r of resolved) {
        rows[r.name]!.push(
          r.rawIdx !== -1
            ? encodeGenotypeFromRaw(callGt, r.rawIdx, ploidy)
            : -1,
        )
      }
    } else if (hasProcessGenotypes(feature) && samplesLen > 0) {
      let i = 0
      feature.processGenotypes((str, start, end) => {
        if (used[i]) {
          dosages[i] = classifyGenotypeDosage(str, start, end)
        }
        i++
      })
      for (let k = 0; k < resolved.length; k++) {
        const idx = resolvedSampleIdx[k]!
        rows[resolved[k]!.name]!.push(idx === -1 ? -1 : dosages[idx]!)
      }
    } else {
      const genotypes = feature.get('genotypes') as Record<string, string>
      for (const r of resolved) {
        rows[r.name]!.push(classifyGenotypeDosage(genotypes[r.key]!))
      }
    }
    checkStopToken2(stopTokenCheck)
  }
  return rows
}
