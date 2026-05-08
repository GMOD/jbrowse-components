import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { parseCigar2 } from '@jbrowse/plugin-alignments'
import {
  buildBpRegionIndex,
  bpToCumBpAndPad,
} from '@jbrowse/synteny-core'

import { splitHiLo } from './hiLoUtils.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface DotplotFeaturesAndPositionsResult {
  p11Hi: Float32Array
  p11Lo: Float32Array
  p12Hi: Float32Array
  p12Lo: Float32Array
  p21Hi: Float32Array
  p21Lo: Float32Array
  p22Hi: Float32Array
  p22Lo: Float32Array
  padHs: Float32Array
  padVs: Float32Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  parsedCigars: number[][]
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
  hViewSnap: BpIndexViewSnap
  vViewSnap: BpIndexViewSnap
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

  // SYNC: parallel impl in packages/synteny-core/src/bpRegionIndex.ts
  const hIndex = buildBpRegionIndex(hViewSnap)
  const vIndex = buildBpRegionIndex(vViewSnap)

  const count = features.length
  const p11Hi = new Float32Array(count)
  const p11Lo = new Float32Array(count)
  const p12Hi = new Float32Array(count)
  const p12Lo = new Float32Array(count)
  const p21Hi = new Float32Array(count)
  const p21Lo = new Float32Array(count)
  const p22Hi = new Float32Array(count)
  const p22Lo = new Float32Array(count)
  const padHsArray = new Float32Array(count)
  const padVsArray = new Float32Array(count)
  const strandsArray = new Int8Array(count)
  const startsArray = new Uint32Array(count)
  const endsArray = new Uint32Array(count)
  const identitiesArray = new Float32Array(count)
  const meanScoresArray = new Float32Array(count)
  const mappingQualsArray = new Float32Array(count)
  const refNames: string[] = []
  const parsedCigars: number[][] = []

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
    const refName = a1?.getCanonicalRefName(rawRefName) ?? rawRefName
    const mateRefName =
      a2?.getCanonicalRefName(rawMateRefName) ?? rawMateRefName

    if (!hIndex.entries.has(refName) || !vIndex.entries.has(mateRefName)) {
      continue
    }

    const start = f.get('start')
    const end = f.get('end')
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end

    const p11 = bpToCumBpAndPad(hIndex, refName, f1s)
    const p12 = bpToCumBpAndPad(hIndex, refName, f1e)
    const p21 = bpToCumBpAndPad(vIndex, mateRefName, mate.start)
    const p22 = bpToCumBpAndPad(vIndex, mateRefName, mate.end)

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }

    splitHiLo(p11Hi, p11Lo, validCount, p11.cumBp)
    splitHiLo(p12Hi, p12Lo, validCount, p12.cumBp)
    splitHiLo(p21Hi, p21Lo, validCount, p21.cumBp)
    splitHiLo(p22Hi, p22Lo, validCount, p22.cumBp)
    padHsArray[validCount] = p11.padPx
    padVsArray[validCount] = p21.padPx

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
    parsedCigars.push(
      parseCigar2((f.get('CIGAR') as string | undefined) ?? ''),
    )
    validCount++
  }

  const result: DotplotFeaturesAndPositionsResult = {
    p11Hi: p11Hi.subarray(0, validCount),
    p11Lo: p11Lo.subarray(0, validCount),
    p12Hi: p12Hi.subarray(0, validCount),
    p12Lo: p12Lo.subarray(0, validCount),
    p21Hi: p21Hi.subarray(0, validCount),
    p21Lo: p21Lo.subarray(0, validCount),
    p22Hi: p22Hi.subarray(0, validCount),
    p22Lo: p22Lo.subarray(0, validCount),
    padHs: padHsArray.subarray(0, validCount),
    padVs: padVsArray.subarray(0, validCount),
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    meanScores: meanScoresArray.subarray(0, validCount),
    mappingQuals: mappingQualsArray.subarray(0, validCount),
    refNames,
    parsedCigars,
  }

  return rpcResult(result, [
    p11Hi.buffer,
    p11Lo.buffer,
    p12Hi.buffer,
    p12Lo.buffer,
    p21Hi.buffer,
    p21Lo.buffer,
    p22Hi.buffer,
    p22Lo.buffer,
    padHsArray.buffer,
    padVsArray.buffer,
    strandsArray.buffer,
    startsArray.buffer,
    endsArray.buffer,
    identitiesArray.buffer,
    meanScoresArray.buffer,
    mappingQualsArray.buffer,
  ] as ArrayBuffer[])
}
