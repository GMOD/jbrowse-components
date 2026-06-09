import { parseCigar2 } from '@jbrowse/alignments-core'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { dedupe } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'

// Float64 because cumBp values reach Gbp-scale, which Float32 can't represent
// without losing per-base precision. Hi/lo splitting happens at the GPU upload
// boundary only — never in plain JS, per project rules.
export interface DotplotFeaturesAndPositionsResult {
  p11: Float64Array
  p12: Float64Array
  p21: Float64Array
  p22: Float64Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  parsedCigars: number[][]
  totalFeatureCount: number
  skippedFeatureCount: number
}

function makeAssemblyLookup(pluginManager: PluginManager) {
  const assemblyManager = pluginManager.rootModel?.session?.assemblyManager
  const cache = new Map<
    string,
    { getCanonicalRefName(n: string): string | undefined } | undefined
  >()
  return (name: string | undefined) => {
    if (!name || !assemblyManager) {
      return undefined
    }
    if (!cache.has(name)) {
      cache.set(name, assemblyManager.get(name))
    }
    return cache.get(name)
  }
}

interface FeatureMate {
  start: number
  end: number
  refName: string
  assemblyName?: string
}

export async function executeDotplotFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  hViewSnap,
  vViewSnap,
  stopToken,
  lodMode,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  hViewSnap: BpIndexViewSnap
  vViewSnap: BpIndexViewSnap
  stopToken?: StopToken
  lodMode?: BaseOptions['lodMode']
}) {
  const adapter = await getAdapter(pluginManager, sessionId, adapterConfig)
  const dataAdapter = adapter.dataAdapter as BaseFeatureDataAdapter

  const rawFeatures = await firstValueFrom(
    dataAdapter
      .getFeaturesInMultipleRegions(regions, {
        stopToken,
        bpPerPx: hViewSnap.bpPerPx,
        lodMode,
      })
      .pipe(toArray()),
  )
  const features = dedupe(rawFeatures, f => f.id())

  const getAssembly = makeAssemblyLookup(pluginManager)

  const hIndex = buildBpRegionIndex(hViewSnap)
  const vIndex = buildBpRegionIndex(vViewSnap)

  // Two-pass strategy avoids over-allocation: first pass walks features and
  // gathers valid (refName-resolved + position-mappable) ones into a working
  // list; second pass writes into tightly-sized typed arrays. Keeps the result
  // free of trailing dead slots and means we never need .subarray().
  interface ValidFeature {
    p11Cum: number
    p12Cum: number
    p21Cum: number
    p22Cum: number
    strand: number
    start: number
    end: number
    identity: number
    meanScore: number
    mappingQual: number
    refName: string
    cigar: number[]
  }
  const valid: ValidFeature[] = []
  let skippedFeatureCount = 0
  for (const f of features) {
    const mate = f.get('mate') as FeatureMate
    const strand = f.get('strand') ?? 1
    const rawRefName = f.get('refName')
    const a1 = getAssembly(f.get('assemblyName') as string | undefined)
    const a2 = getAssembly(mate.assemblyName)
    const refName = a1?.getCanonicalRefName(rawRefName) ?? rawRefName
    const mateRefName = a2?.getCanonicalRefName(mate.refName) ?? mate.refName

    if (!hIndex.entries.has(refName) || !vIndex.entries.has(mateRefName)) {
      skippedFeatureCount++
      continue
    }

    const start = f.get('start')
    const end = f.get('end')
    // Reversed strand: swap start/end on the H axis so p11→p12 is a left→right
    // walk on screen regardless of strand.
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end

    const p11 = bpToCumBp(hIndex, refName, f1s)
    const p12 = bpToCumBp(hIndex, refName, f1e)
    const p21 = bpToCumBp(vIndex, mateRefName, mate.start)
    const p22 = bpToCumBp(vIndex, mateRefName, mate.end)
    if (p11 === undefined || p12 === undefined || p21 === undefined || p22 === undefined) {
      skippedFeatureCount++
      continue
    }

    valid.push({
      p11Cum: p11,
      p12Cum: p12,
      p21Cum: p21,
      p22Cum: p22,
      strand,
      start,
      end,
      identity: (f.get('identity') as number | undefined) ?? -1,
      meanScore: (f.get('meanScore') as number | undefined) ?? -1,
      mappingQual: (f.get('mappingQual') as number | undefined) ?? -1,
      refName: rawRefName,
      cigar: parseCigar2((f.get('CIGAR') as string | undefined) ?? ''),
    })
  }

  const n = valid.length
  const result: DotplotFeaturesAndPositionsResult = {
    p11: new Float64Array(n),
    p12: new Float64Array(n),
    p21: new Float64Array(n),
    p22: new Float64Array(n),
    strands: new Int8Array(n),
    starts: new Uint32Array(n),
    ends: new Uint32Array(n),
    identities: new Float32Array(n),
    meanScores: new Float32Array(n),
    mappingQuals: new Float32Array(n),
    refNames: new Array<string>(n),
    parsedCigars: new Array<number[]>(n),
    totalFeatureCount: features.length,
    skippedFeatureCount,
  }
  for (let i = 0; i < n; i++) {
    const v = valid[i]!
    result.p11[i] = v.p11Cum
    result.p12[i] = v.p12Cum
    result.p21[i] = v.p21Cum
    result.p22[i] = v.p22Cum
    result.strands[i] = v.strand
    result.starts[i] = v.start
    result.ends[i] = v.end
    result.identities[i] = v.identity
    result.meanScores[i] = v.meanScore
    result.mappingQuals[i] = v.mappingQual
    result.refNames[i] = v.refName
    result.parsedCigars[i] = v.cigar
  }

  return rpcResult(result, [
    result.p11.buffer,
    result.p12.buffer,
    result.p21.buffer,
    result.p22.buffer,
    result.strands.buffer,
    result.starts.buffer,
    result.ends.buffer,
    result.identities.buffer,
    result.meanScores.buffer,
    result.mappingQuals.buffer,
  ])
}
