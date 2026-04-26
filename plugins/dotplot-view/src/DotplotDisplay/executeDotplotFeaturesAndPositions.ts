import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, ViewSnap } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RegionIndexEntry {
  region: { refName: string; start: number; end: number; reversed?: boolean }
  bpBefore: number
  paddingBpBefore: number
}

export interface BpToPxIndex {
  entries: Map<string, RegionIndexEntry[]>
  bpPerPx: number
}

// SYNC: parallel impl in executeSyntenyFeaturesAndPositions.ts in linear-comparative-view;
// that version returns {index, offsetPx, paddingPx} for region disambiguation
export function buildBpToPxIndex(self: ViewSnap): BpToPxIndex {
  const {
    interRegionPaddingWidth,
    bpPerPx,
    displayedRegions,
    minimumBlockWidth,
  } = self
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx
  const entries = new Map<string, RegionIndexEntry[]>()
  let bpSoFar = 0
  let paddingBp = 0

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const entry: RegionIndexEntry = {
      region: r,
      bpBefore: bpSoFar,
      paddingBpBefore: paddingBp,
    }
    let list = entries.get(r.refName)
    if (!list) {
      list = []
      entries.set(r.refName, list)
    }
    list.push(entry)

    bpSoFar += len
    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      paddingBp += interRegionPaddingBp
    }
  }
  return { entries, bpPerPx }
}

export function bpToPxFromIndex(
  idx: BpToPxIndex,
  refName: string,
  coord: number,
) {
  const list = idx.entries.get(refName)
  if (!list) {
    return undefined
  }
  for (const entry of list) {
    const r = entry.region
    if (coord >= r.start && coord <= r.end) {
      const bpOffset = r.reversed ? r.end - coord : coord - r.start
      return (entry.bpBefore + bpOffset + entry.paddingBpBefore) / idx.bpPerPx
    }
  }
  return undefined
}

// Pixel offsets stored as Float64: needed because Float32's 24-bit mantissa
// loses integer precision above ~16M, and at low bpPerPx on large genomes a
// pixel offset can approach the raw 3Gbp range. Float64 is exact for any
// value we'd ever see, and avoids the sub-pixel rounding that Uint32 would
// require.
export interface DotplotFeaturesAndPositionsResult {
  p11_offsetPx: Float64Array
  p12_offsetPx: Float64Array
  p21_offsetPx: Float64Array
  p22_offsetPx: Float64Array
  strands: Int8Array
  starts: Uint32Array
  ends: Uint32Array
  identities: Float32Array
  meanScores: Float32Array
  mappingQuals: Float32Array
  refNames: string[]
  cigars: string[]
  bpPerPxH: number
  bpPerPxV: number
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

  const hIndex = buildBpToPxIndex(hViewSnap)
  const vIndex = buildBpToPxIndex(vViewSnap)

  const count = features.length
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
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

    if (!hIndex.entries.has(refName) || !vIndex.entries.has(mateRefName)) {
      continue
    }

    const start = f.get('start')
    const end = f.get('end')
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end

    const p11 = bpToPxFromIndex(hIndex, refName, f1s)
    const p12 = bpToPxFromIndex(hIndex, refName, f1e)
    const p21 = bpToPxFromIndex(vIndex, mateRefName, mate.start)
    const p22 = bpToPxFromIndex(vIndex, mateRefName, mate.end)

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }

    p11Array[validCount] = p11
    p12Array[validCount] = p12
    p21Array[validCount] = p21
    p22Array[validCount] = p22
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
    p11_offsetPx: p11Array.subarray(0, validCount),
    p12_offsetPx: p12Array.subarray(0, validCount),
    p21_offsetPx: p21Array.subarray(0, validCount),
    p22_offsetPx: p22Array.subarray(0, validCount),
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    meanScores: meanScoresArray.subarray(0, validCount),
    mappingQuals: mappingQualsArray.subarray(0, validCount),
    refNames,
    cigars,
    bpPerPxH: hViewSnap.bpPerPx,
    bpPerPxV: vViewSnap.bpPerPx,
  }

  return rpcResult(result, [
    p11Array.buffer,
    p12Array.buffer,
    p21Array.buffer,
    p22Array.buffer,
    strandsArray.buffer,
    startsArray.buffer,
    endsArray.buffer,
    identitiesArray.buffer,
    meanScoresArray.buffer,
    mappingQualsArray.buffer,
  ] as ArrayBuffer[])
}
