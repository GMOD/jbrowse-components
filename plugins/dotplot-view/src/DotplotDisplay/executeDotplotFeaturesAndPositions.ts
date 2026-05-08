import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { parseCigar2 } from '@jbrowse/plugin-alignments'
import {
  buildBpRegionIndex,
  bpToCumBpAndPad,
} from '@jbrowse/synteny-core'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { BpIndexViewSnap } from '@jbrowse/synteny-core'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface DotplotFeaturesAndPositionsResult {
  p11BpHi: Float32Array
  p11BpLo: Float32Array
  p12BpHi: Float32Array
  p12BpLo: Float32Array
  p21BpHi: Float32Array
  p21BpLo: Float32Array
  p22BpHi: Float32Array
  p22BpLo: Float32Array
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

function splitHiLo(
  cumBp: number,
  hiArr: Float32Array,
  loArr: Float32Array,
  idx: number,
) {
  const iv = Math.floor(cumBp)
  const lo = iv - Math.floor(iv / 4096) * 4096
  hiArr[idx] = iv - lo
  loArr[idx] = lo + (cumBp - iv)
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
  const p11HiArray = new Float32Array(count)
  const p11LoArray = new Float32Array(count)
  const p12HiArray = new Float32Array(count)
  const p12LoArray = new Float32Array(count)
  const p21HiArray = new Float32Array(count)
  const p21LoArray = new Float32Array(count)
  const p22HiArray = new Float32Array(count)
  const p22LoArray = new Float32Array(count)
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

    splitHiLo(p11.cumBp, p11HiArray, p11LoArray, validCount)
    splitHiLo(p12.cumBp, p12HiArray, p12LoArray, validCount)
    splitHiLo(p21.cumBp, p21HiArray, p21LoArray, validCount)
    splitHiLo(p22.cumBp, p22HiArray, p22LoArray, validCount)
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
    p11BpHi: p11HiArray.subarray(0, validCount),
    p11BpLo: p11LoArray.subarray(0, validCount),
    p12BpHi: p12HiArray.subarray(0, validCount),
    p12BpLo: p12LoArray.subarray(0, validCount),
    p21BpHi: p21HiArray.subarray(0, validCount),
    p21BpLo: p21LoArray.subarray(0, validCount),
    p22BpHi: p22HiArray.subarray(0, validCount),
    p22BpLo: p22LoArray.subarray(0, validCount),
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
    p11HiArray.buffer,
    p11LoArray.buffer,
    p12HiArray.buffer,
    p12LoArray.buffer,
    p21HiArray.buffer,
    p21LoArray.buffer,
    p22HiArray.buffer,
    p22LoArray.buffer,
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
