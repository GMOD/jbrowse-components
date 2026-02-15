import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { executeSyntenyInstanceData } from './executeSyntenyInstanceData.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, ViewSnap } from '@jbrowse/core/util'

// Stable bpToPx that ALWAYS includes inter-region padding for every displayed
// region, not just those with visible content blocks. The core bpToPx only
// adds padding for regions with content blocks, which makes pixel positions
// shift when content blocks change during scroll. Also uses float precision
// (no Math.round) since the shader uses HP float subtraction.
function bpToPx({
  self,
  refName,
  coord,
  regionNumber,
}: {
  self: ViewSnap
  refName: string
  coord: number
  regionNumber?: number
}) {
  let bpSoFar = 0
  const { interRegionPaddingWidth, bpPerPx, displayedRegions } = self
  const interRegionPaddingBp = interRegionPaddingWidth * bpPerPx

  let i = 0
  for (let l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (regionNumber ? regionNumber === i : true)
    ) {
      bpSoFar += r.reversed ? r.end - coord : coord - r.start
      break
    }
    bpSoFar += len + interRegionPaddingBp
  }
  const found = displayedRegions[i]
  if (found) {
    return {
      index: i,
      offsetPx: bpSoFar / bpPerPx,
      paddingPx: i * interRegionPaddingWidth,
    }
  }
  return undefined
}

export async function executeSyntenyFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  viewSnaps,
  level,
  stopToken,
  colorBy = 'default',
  drawCurves = true,
  drawCIGAR = true,
  drawCIGARMatchesOnly = false,
  drawLocationMarkers = false,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  viewSnaps: ViewSnap[]
  level: number
  stopToken?: string
  colorBy?: string
  drawCurves?: boolean
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
  drawLocationMarkers?: boolean
}) {
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const features = await firstValueFrom(
    dataAdapter
      .getFeaturesInMultipleRegions(regions, { stopToken })
      .pipe(toArray()),
  )

  const v1 = viewSnaps[level]!
  const v2 = viewSnaps[level + 1]!

  const count = features.length
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
  const strandsArray = new Int8Array(count)
  const startsArray = new Float64Array(count)
  const endsArray = new Float64Array(count)
  const identitiesArray = new Float64Array(count)
  const padTopArray = new Float64Array(count)
  const padBottomArray = new Float64Array(count)

  const featureIds: string[] = []
  const names: string[] = []
  const refNames: string[] = []
  const assemblyNames: string[] = []
  const cigars: string[] = []
  const mates: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }[] = []

  const stopTokenChecker = createStopTokenChecker(stopToken)
  let validCount = 0
  for (const f of features) {
    checkStopToken2(stopTokenChecker)
    const strand = f.get('strand') as number
    const mate = f.get('mate') as {
      start: number
      end: number
      refName: string
      name: string
      assemblyName: string
    }
    const refName = f.get('refName')
    const start = f.get('start')
    const end = f.get('end')

    let f1s = start
    let f1e = end
    if (strand === -1) {
      ;[f1e, f1s] = [f1s, f1e]
    }

    const p11 = bpToPx({ self: v1, refName, coord: f1s })
    const p12 = bpToPx({ self: v1, refName, coord: f1e })
    const p21 = bpToPx({ self: v2, refName: mate.refName, coord: mate.start })
    const p22 = bpToPx({ self: v2, refName: mate.refName, coord: mate.end })

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }

    p11Array[validCount] = p11.offsetPx
    p12Array[validCount] = p12.offsetPx
    p21Array[validCount] = p21.offsetPx
    p22Array[validCount] = p22.offsetPx
    padTopArray[validCount] = p11.paddingPx
    padBottomArray[validCount] = p21.paddingPx
    strandsArray[validCount] = strand
    startsArray[validCount] = start
    endsArray[validCount] = end

    const identity = f.get('identity') as number | undefined
    identitiesArray[validCount] = identity ?? -1

    featureIds.push(f.id())
    names.push((f.get('name') as string) || '')
    refNames.push(refName)
    assemblyNames.push((f.get('assemblyName') as string) || '')
    cigars.push((f.get('CIGAR') as string) || '')
    mates.push(mate)

    validCount++
  }

  const positionData = {
    p11_offsetPx: p11Array.slice(0, validCount),
    p12_offsetPx: p12Array.slice(0, validCount),
    p21_offsetPx: p21Array.slice(0, validCount),
    p22_offsetPx: p22Array.slice(0, validCount),
    strands: strandsArray.slice(0, validCount),
    starts: startsArray.slice(0, validCount),
    ends: endsArray.slice(0, validCount),
    identities: identitiesArray.slice(0, validCount),
    padTop: padTopArray.slice(0, validCount),
    padBottom: padBottomArray.slice(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    cigars,
    mates,
  }

  const bpPerPxs = viewSnaps.map(v => v.bpPerPx)
  const instanceData = executeSyntenyInstanceData({
    ...positionData,
    colorBy,
    drawCurves,
    drawCIGAR,
    drawCIGARMatchesOnly,
    drawLocationMarkers,
    bpPerPxs,
    level,
  })

  const result = {
    ...positionData,
    instanceData,
  }

  return rpcResult(result, [
    result.p11_offsetPx.buffer,
    result.p12_offsetPx.buffer,
    result.p21_offsetPx.buffer,
    result.p22_offsetPx.buffer,
    result.strands.buffer,
    result.starts.buffer,
    result.ends.buffer,
    result.identities.buffer,
    result.padTop.buffer,
    result.padBottom.buffer,
    instanceData.x1.buffer,
    instanceData.x2.buffer,
    instanceData.x3.buffer,
    instanceData.x4.buffer,
    instanceData.colors.buffer,
    instanceData.featureIds.buffer,
    instanceData.isCurves.buffer,
    instanceData.queryTotalLengths.buffer,
    instanceData.padTops.buffer,
    instanceData.padBottoms.buffer,
  ] as ArrayBuffer[])
}
