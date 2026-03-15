import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { parseCigar2 } from '@jbrowse/plugin-alignments'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { executeSyntenyInstanceData } from './executeSyntenyInstanceData.ts'

import type { SyntenyInstanceData } from './executeSyntenyInstanceData.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region, ViewSnap } from '@jbrowse/core/util'

export interface SyntenyRpcResult extends SyntenyFeatureData {
  instanceData: SyntenyInstanceData
}

// Returns genomic-only pixel offset (no inter-region padding baked in) plus
// the cumulative padding pixels before the target region. Padding is counted
// only between non-elided regions, matching calculateStaticBlocks. Uses float
// precision (no Math.round) since the shader uses HP float subtraction.
export function bpToPx({
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
  const {
    interRegionPaddingWidth,
    bpPerPx,
    displayedRegions,
    minimumBlockWidth,
  } = self
  let paddingPx = 0

  let i = 0
  for (let l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    if (
      refName === r.refName &&
      coord >= r.start &&
      coord <= r.end &&
      (regionNumber !== undefined ? regionNumber === i : true)
    ) {
      bpSoFar += r.reversed ? r.end - coord : coord - r.start
      break
    }
    bpSoFar += len
    const regionWidthPx = len / bpPerPx
    if (regionWidthPx >= minimumBlockWidth && i < l - 1) {
      paddingPx += interRegionPaddingWidth
    }
  }
  const found = displayedRegions[i]
  if (found) {
    return {
      index: i,
      offsetPx: bpSoFar / bpPerPx + paddingPx,
      paddingPx,
    }
  }
  return undefined
}

interface RegionIndexEntry {
  index: number
  region: { refName: string; start: number; end: number; reversed?: boolean }
  bpBefore: number
  paddingPxBefore: number
}

export interface BpToPxIndex {
  entries: Map<string, RegionIndexEntry[]>
  bpPerPx: number
}

export function buildBpToPxIndex(self: ViewSnap): BpToPxIndex {
  const {
    interRegionPaddingWidth,
    bpPerPx,
    displayedRegions,
    minimumBlockWidth,
  } = self
  const entries = new Map<string, RegionIndexEntry[]>()
  let bpSoFar = 0
  let paddingPx = 0

  for (let i = 0, l = displayedRegions.length; i < l; i++) {
    const r = displayedRegions[i]!
    const len = r.end - r.start
    const entry: RegionIndexEntry = {
      index: i,
      region: r,
      bpBefore: bpSoFar,
      paddingPxBefore: paddingPx,
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
      paddingPx += interRegionPaddingWidth
    }
  }
  return { entries, bpPerPx }
}

export function bpToPxFromIndex(
  idx: BpToPxIndex,
  refName: string,
  coord: number,
  regionNumber?: number,
) {
  const list = idx.entries.get(refName)
  if (!list) {
    return undefined
  }
  for (const entry of list) {
    const r = entry.region
    if (
      coord >= r.start &&
      coord <= r.end &&
      (regionNumber !== undefined ? regionNumber === entry.index : true)
    ) {
      const bpOffset = r.reversed ? r.end - coord : coord - r.start
      return {
        index: entry.index,
        offsetPx:
          (entry.bpBefore + bpOffset) / idx.bpPerPx + entry.paddingPxBefore,
        paddingPx: entry.paddingPxBefore,
      }
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

  const bpPerPx = viewSnaps[level]!.bpPerPx
  const allFeatures = await firstValueFrom(
    dataAdapter
      .getFeaturesInMultipleRegions(regions, { stopToken, bpPerPx })
      .pipe(toArray()),
  )
  const seen = new Set<string>()
  const features = allFeatures.filter(f => {
    const id = f.id()
    if (seen.has(id)) {
      return false
    }
    seen.add(id)
    return true
  })

  const v1 = viewSnaps[level]!
  const v2 = viewSnaps[level + 1]!
  const v1Index = buildBpToPxIndex(v1)
  const v2Index = buildBpToPxIndex(v2)

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

  // Viewport culling: skip features entirely outside the visible area in
  // both views. A synteny parallelogram is visible when at least one of its
  // edges (top=view1, bottom=view2) overlaps the viewport.
  const viewWidth = v1.width
  const v1Offset = v1.offsetPx
  const v2Offset = v2.offsetPx
  const bufferPx = viewWidth * 0.5

  const stopTokenChecker = createStopTokenChecker(stopToken)
  let validCount = 0
  let culledCount = 0
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

    const p11 = bpToPxFromIndex(v1Index, refName, f1s)
    const p12 = bpToPxFromIndex(v1Index, refName, f1e)
    const p21 = bpToPxFromIndex(v2Index, mate.refName, mate.start)
    const p22 = bpToPxFromIndex(v2Index, mate.refName, mate.end)

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }

    // Cull features where BOTH view projections are entirely off-screen.
    // A feature is visible if its top OR bottom edge overlaps the viewport.
    const topMinX = Math.min(p11.offsetPx, p12.offsetPx) - v1Offset
    const topMaxX = Math.max(p11.offsetPx, p12.offsetPx) - v1Offset
    const botMinX = Math.min(p21.offsetPx, p22.offsetPx) - v2Offset
    const botMaxX = Math.max(p21.offsetPx, p22.offsetPx) - v2Offset

    const topOffScreen = topMaxX < -bufferPx || topMinX > viewWidth + bufferPx
    const botOffScreen = botMaxX < -bufferPx || botMinX > viewWidth + bufferPx

    if (topOffScreen && botOffScreen) {
      culledCount++
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

  console.debug(
    `[synteny] features: ${features.length} total, ${validCount} visible, ${culledCount} culled by viewport`,
  )

  const positionData = {
    p11_offsetPx: p11Array.subarray(0, validCount),
    p12_offsetPx: p12Array.subarray(0, validCount),
    p21_offsetPx: p21Array.subarray(0, validCount),
    p22_offsetPx: p22Array.subarray(0, validCount),
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    padTop: padTopArray.subarray(0, validCount),
    padBottom: padBottomArray.subarray(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    cigars,
    mates,
  }

  const parsedCigars = cigars.map(s => (s ? parseCigar2(s) : []))
  const bpPerPxs = viewSnaps.map(v => v.bpPerPx)
  const instanceData = executeSyntenyInstanceData({
    ...positionData,
    parsedCigars,
    colorBy,
    drawCurves,
    drawCIGAR,
    drawCIGARMatchesOnly,
    drawLocationMarkers,
    bpPerPxs,
    level,
    viewOffsets: viewSnaps.map(v => v.offsetPx),
    viewWidth: viewSnaps[0]!.width,
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
