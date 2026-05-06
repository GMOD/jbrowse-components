import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { parseCigar2 } from '@jbrowse/plugin-alignments'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'
import { chainCollinearAlignments } from './chainCollinearAlignments.ts'

import type { SyntenyGeometry } from './buildSyntenyGeometry.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface SyntenyViewSnap {
  bpPerPx: number
  interRegionPaddingWidth: number
  minimumBlockWidth: number
  width: number
  offsetPx: number
  displayedRegions: Region[]
}

export interface SyntenyRpcResult extends SyntenyFeatureData {
  instanceData: SyntenyGeometry
}

// Returns genomic-only pixel offset (no inter-region padding baked in) plus
// the cumulative padding pixels before the target region. Padding is counted
// only between non-elided regions, matching calculateStaticBlocks. Uses float
// precision (no Math.round) since the shader uses HP float subtraction.
export function bpToPx({
  self,
  refName,
  coord,
  displayedRegionIndex,
}: {
  self: SyntenyViewSnap
  refName: string
  coord: number
  displayedRegionIndex?: number
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
      (displayedRegionIndex !== undefined ? displayedRegionIndex === i : true)
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
      cumBp: bpSoFar,
    }
  }
  return undefined
}

interface RegionIndexEntry {
  index: number
  region: Region
  bpBefore: number
  paddingPxBefore: number
}

export interface BpToPxIndex {
  entries: Map<string, RegionIndexEntry[]>
  bpPerPx: number
}

// SYNC: parallel impl in executeDotplotFeaturesAndPositions.ts in dotplot-view;
// that version returns a scalar offsetPx (no region index needed)
export function buildBpToPxIndex(self: SyntenyViewSnap): BpToPxIndex {
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
  displayedRegionIndex?: number,
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
      (displayedRegionIndex !== undefined
        ? displayedRegionIndex === entry.index
        : true)
    ) {
      const bpOffset = r.reversed ? r.end - coord : coord - r.start
      const cumBp = entry.bpBefore + bpOffset
      return {
        index: entry.index,
        offsetPx: cumBp / idx.bpPerPx + entry.paddingPxBefore,
        paddingPx: entry.paddingPxBefore,
        cumBp,
      }
    }
  }
  return undefined
}

export async function executeSyntenyFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  viewSnaps,
  level,
  stopToken,
  drawCIGAR = true,
  drawCIGARMatchesOnly = false,
  drawLocationMarkers = false,
  chainMerge = false,
  statusCallback,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  viewSnaps: SyntenyViewSnap[]
  level: number
  stopToken?: StopToken
  drawCIGAR?: boolean
  drawCIGARMatchesOnly?: boolean
  drawLocationMarkers?: boolean
  chainMerge?: boolean
  statusCallback?: (msg: string) => void
}) {
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const bpPerPx = viewSnaps[level]!.bpPerPx
  const allFeatures = await updateStatus(
    'Fetching synteny features',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter
          .getFeaturesInMultipleRegions(viewSnaps[level]!.displayedRegions, {
            stopToken,
            bpPerPx,
          })
          .pipe(toArray()),
      ),
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

  const processedFeatures = chainMerge
    ? await updateStatus('Chaining collinear alignments', statusCallback, () =>
        chainCollinearAlignments(
          features,
          Math.min(10_000_000, Math.max(v1.bpPerPx, v2.bpPerPx) * 50),
        ),
      )
    : features

  const v1Index = buildBpToPxIndex(v1)
  const v2Index = buildBpToPxIndex(v2)

  const count = processedFeatures.length
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
  const strandsArray = new Int8Array(count)
  // bp coordinates fit in uint32 (max 4.3 Gbp covers human/mouse/most genomes).
  // Pixel offsets (p11..p22, padTop, padBottom) stay Float64 because they
  // accumulate across regions × 1/bpPerPx and routinely exceed 2^32.
  const startsArray = new Uint32Array(count)
  const endsArray = new Uint32Array(count)
  const mateStartsArray = new Uint32Array(count)
  const mateEndsArray = new Uint32Array(count)
  const identitiesArray = new Float32Array(count)
  const padTopArray = new Float64Array(count)
  const padBottomArray = new Float64Array(count)

  const featureIds: string[] = []
  const names: string[] = []
  const refNames: string[] = []
  const assemblyNames: string[] = []
  const mateRefNames: string[] = []
  const mateAssemblyNames: string[] = []
  const parsedCigars: number[][] = []
  // Always collect syriType; main-thread colorBy='syri' reads this directly
  // so the RPC doesn't refetch on a color-scheme change. Undefined entries
  // fall back to main-thread computeSyriTypes when the scheme is active.
  const precomputedSyriTypes: (string | undefined)[] = []

  // Viewport culling: skip features entirely outside the visible area in
  // both views. A synteny parallelogram is visible when at least one of its
  // edges (top=view1, bottom=view2) overlaps the viewport.
  const viewWidth = v1.width
  const v1Offset = v1.offsetPx
  const v2Offset = v2.offsetPx
  const bufferPx = viewWidth * 0.5
  const offScreenLeftBound = -bufferPx
  const offScreenRightBound = viewWidth + bufferPx

  const v1RefNames = v1Index.entries
  const v2RefNames = v2Index.entries
  const stopTokenChecker = createStopTokenChecker(stopToken)
  let validCount = 0
  for (const f of processedFeatures) {
    checkStopToken2(stopTokenChecker)
    const refName = f.get('refName') as string
    const mate = f.get('mate') as {
      start: number
      end: number
      refName: string
      assemblyName: string
    }
    // Whole-genome PAF at low zoom: most features are on refNames not in the
    // displayed regions of one or both views. Skip them before any bpToPx
    // arithmetic / object allocation. bpToPxFromIndex would also return
    // undefined here, but only after a Map.get + result-object construction
    // per call (4 per feature).
    if (!v1RefNames.has(refName) || !v2RefNames.has(mate.refName)) {
      continue
    }

    const strand = f.get('strand') as number
    const start = f.get('start') as number
    const end = f.get('end') as number
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end

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

    const topOffScreen =
      topMaxX < offScreenLeftBound || topMinX > offScreenRightBound
    const botOffScreen =
      botMaxX < offScreenLeftBound || botMinX > offScreenRightBound

    if (topOffScreen && botOffScreen) {
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

    mateStartsArray[validCount] = mate.start
    mateEndsArray[validCount] = mate.end

    featureIds.push(f.id())
    names.push((f.get('name') as string | undefined) ?? '')
    refNames.push(refName)
    assemblyNames.push((f.get('assemblyName') as string | undefined) ?? '')
    mateRefNames.push(mate.refName)
    mateAssemblyNames.push(mate.assemblyName)
    parsedCigars.push(parseCigar2((f.get('CIGAR') as string | undefined) ?? ''))
    precomputedSyriTypes.push(f.get('syriType') as string | undefined)

    validCount++
  }

  // Pixel-space positions / pad arrays are intermediate buffers consumed only
  // by buildSyntenyGeometry below. They never leave the worker — the main
  // thread reads bp-space hi/lo pairs out of `instanceData`.
  const p11_offsetPx = p11Array.subarray(0, validCount)
  const p12_offsetPx = p12Array.subarray(0, validCount)
  const p21_offsetPx = p21Array.subarray(0, validCount)
  const p22_offsetPx = p22Array.subarray(0, validCount)
  const padTop = padTopArray.subarray(0, validCount)
  const padBottom = padBottomArray.subarray(0, validCount)

  const featureData = {
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    syriTypes: precomputedSyriTypes,
    mateStarts: mateStartsArray.subarray(0, validCount),
    mateEnds: mateEndsArray.subarray(0, validCount),
    mateRefNames,
    mateAssemblyNames,
  }

  // colorBy lives on the main thread now; the worker always emits
  // geometry + per-instance `kinds`/`instanceFeatureIdx` descriptors, and
  // the display model recomputes `colors` on colorBy change. SyRI types
  // are likewise computed on the main thread when needed.

  const instanceData = await updateStatus(
    'Computing synteny layout',
    statusCallback,
    () =>
      buildSyntenyGeometry({
        p11_offsetPx,
        p12_offsetPx,
        p21_offsetPx,
        p22_offsetPx,
        padTop,
        padBottom,
        strands: featureData.strands,
        names,
        parsedCigars,
        starts: featureData.starts,
        ends: featureData.ends,
        drawCIGAR,
        drawCIGARMatchesOnly,
        drawLocationMarkers,
        bpPerPx0: v1.bpPerPx,
        bpPerPx1: v2.bpPerPx,
        viewOff0: v1.offsetPx,
        viewOff1: v2.offsetPx,
        viewWidth,
      }),
  )

  return rpcResult(
    { ...featureData, instanceData },
    [
      featureData.strands.buffer,
      featureData.starts.buffer,
      featureData.ends.buffer,
      featureData.identities.buffer,
      featureData.mateStarts.buffer,
      featureData.mateEnds.buffer,
      instanceData.bp1Hi.buffer,
      instanceData.bp1Lo.buffer,
      instanceData.bp2Hi.buffer,
      instanceData.bp2Lo.buffer,
      instanceData.bp3Hi.buffer,
      instanceData.bp3Lo.buffer,
      instanceData.bp4Hi.buffer,
      instanceData.bp4Lo.buffer,
      instanceData.kinds.buffer,
      instanceData.instanceFeatureIdx.buffer,
      instanceData.queryTotalLengths.buffer,
      instanceData.padTops.buffer,
      instanceData.padBottoms.buffer,
    ] as ArrayBuffer[],
  )
}
