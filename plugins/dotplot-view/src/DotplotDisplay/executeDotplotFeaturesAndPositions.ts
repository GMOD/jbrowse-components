import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  bpInRegionFromIndex,
  buildBpInRegionIndex,
} from '@jbrowse/core/util/bpProjection'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, ViewSnap } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface DotplotFeaturesAndPositionsResult {
  // bp-in-region for each corner. Renderer projects these against per-view
  // ViewProjection tables (see @jbrowse/core/util/bpProjection).
  p11_bp: Uint32Array
  p12_bp: Uint32Array
  p21_bp: Uint32Array
  p22_bp: Uint32Array
  xRegionIdx: Uint8Array
  yRegionIdx: Uint8Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  cigars: string[]
}

export async function executeDotplotFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  hViewSnap,
  vViewSnap,
  stopToken,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  hViewSnap: ViewSnap
  vViewSnap: ViewSnap
  stopToken?: StopToken
}) {
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const bpPerPx = hViewSnap.bpPerPx
  const rawFeatures = await firstValueFrom(
    dataAdapter
      .getFeaturesInMultipleRegions(regions, { stopToken, bpPerPx })
      .pipe(toArray()),
  )

  const seen = new Set<string>()
  const features = rawFeatures.filter(f => {
    const id = f.id()
    if (seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })

  const assemblyManager = pluginManager.rootModel?.session?.assemblyManager
  const assemblyCache = new Map<
    string,
    { getCanonicalRefName(n: string): string | undefined } | undefined
  >()
  const getAssembly = (name: string | undefined) => {
    if (!name || !assemblyManager) {
      return undefined
    }
    if (assemblyCache.has(name)) {
      return assemblyCache.get(name)
    }
    const a = assemblyManager.get(name)
    assemblyCache.set(name, a)
    return a
  }

  const hIndex = buildBpInRegionIndex(hViewSnap.displayedRegions)
  const vIndex = buildBpInRegionIndex(vViewSnap.displayedRegions)

  const count = features.length
  const p11Array = new Uint32Array(count)
  const p12Array = new Uint32Array(count)
  const p21Array = new Uint32Array(count)
  const p22Array = new Uint32Array(count)
  const xRegionIdxArray = new Uint8Array(count)
  const yRegionIdxArray = new Uint8Array(count)
  const strandsArray = new Int8Array(count)
  const startsArray = new Uint32Array(count)
  const endsArray = new Uint32Array(count)
  const identitiesArray = new Float32Array(count)
  const meanScoresArray = new Float32Array(count)
  const mappingQualsArray = new Float32Array(count)
  const refNames: string[] = []
  const cigars: string[] = []

  let validCount = 0
  for (const f of features) {
    const mate = f.get('mate') as {
      start: number
      end: number
      refName: string
      assemblyName?: string
    }
    const strand = f.get('strand') ?? 1
    const rawRefName = f.get('refName')
    const rawMateRefName = mate.refName
    const a1 = getAssembly(f.get('assemblyName') as string | undefined)
    const a2 = getAssembly(mate.assemblyName)
    const refName = a1?.getCanonicalRefName(rawRefName) || rawRefName
    const mateRefName =
      a2?.getCanonicalRefName(rawMateRefName) || rawMateRefName

    const start = f.get('start')
    const end = f.get('end')
    let f1s = start
    let f1e = end
    if (strand === -1) {
      ;[f1e, f1s] = [f1s, f1e]
    }

    const p11 = bpInRegionFromIndex(hIndex, refName, f1s)
    const p12 = bpInRegionFromIndex(hIndex, refName, f1e)
    const p21 = bpInRegionFromIndex(vIndex, mateRefName, mate.start)
    const p22 = bpInRegionFromIndex(vIndex, mateRefName, mate.end)

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }
    // Drop straddlers: feature spans across two displayed regions on the
    // same axis. See agent-docs/SYNTENY_BP_REFACTOR.md "Straddler handling".
    if (p11.regionIdx !== p12.regionIdx || p21.regionIdx !== p22.regionIdx) {
      continue
    }

    p11Array[validCount] = p11.bpInRegion
    p12Array[validCount] = p12.bpInRegion
    p21Array[validCount] = p21.bpInRegion
    p22Array[validCount] = p22.bpInRegion
    xRegionIdxArray[validCount] = p11.regionIdx
    yRegionIdxArray[validCount] = p21.regionIdx
    strandsArray[validCount] = strand
    startsArray[validCount] = start
    endsArray[validCount] = end
    identitiesArray[validCount] =
      (f.get('identity') as number | undefined) ?? -1
    meanScoresArray[validCount] =
      (f.get('meanScore') as number | undefined) ?? -1
    mappingQualsArray[validCount] =
      (f.get('mappingQual') as number | undefined) ?? -1
    refNames.push(rawRefName)
    cigars.push((f.get('CIGAR') as string | undefined) ?? '')
    validCount++
  }

  const result: DotplotFeaturesAndPositionsResult = {
    p11_bp: p11Array.subarray(0, validCount),
    p12_bp: p12Array.subarray(0, validCount),
    p21_bp: p21Array.subarray(0, validCount),
    p22_bp: p22Array.subarray(0, validCount),
    xRegionIdx: xRegionIdxArray.subarray(0, validCount),
    yRegionIdx: yRegionIdxArray.subarray(0, validCount),
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    meanScores: meanScoresArray.subarray(0, validCount),
    mappingQuals: mappingQualsArray.subarray(0, validCount),
    refNames,
    cigars,
  }

  return rpcResult(result, [
    p11Array.buffer,
    p12Array.buffer,
    p21Array.buffer,
    p22Array.buffer,
    xRegionIdxArray.buffer,
    yRegionIdxArray.buffer,
    strandsArray.buffer,
    startsArray.buffer,
    endsArray.buffer,
    identitiesArray.buffer,
    meanScoresArray.buffer,
    mappingQualsArray.buffer,
  ] as ArrayBuffer[])
}
