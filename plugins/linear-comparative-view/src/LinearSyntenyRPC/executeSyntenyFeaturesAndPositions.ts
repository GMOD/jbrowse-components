import { parseCigar2Typed } from '@jbrowse/alignments-core'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { updateStatus } from '@jbrowse/core/util'
import { rpcResult } from '@jbrowse/core/util/librpc'
import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'
import { bpToCumBp, buildBpRegionIndex } from '@jbrowse/synteny-core'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { buildSyntenyGeometry } from './buildSyntenyGeometry.ts'

import type { SyntenyGeometry } from './buildSyntenyGeometry.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type {
  BaseFeatureDataAdapter,
  BaseOptions,
} from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const EMPTY_CIGAR = new Uint32Array(0)

export interface SyntenyViewSnap {
  bpPerPx: number
  minimumBlockWidth: number
  width: number
  offsetPx: number
  displayedRegions: Region[]
}

export interface SyntenyRpcResult extends SyntenyFeatureData {
  instanceData: SyntenyGeometry
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
  lodMode,
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
  lodMode?: BaseOptions['lodMode']
  statusCallback?: (msg: string) => void
}) {
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  const bpPerPx = viewSnaps[level]!.bpPerPx
  const allFeatures = await updateStatus('Loading', statusCallback, () =>
    firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(viewSnaps[level]!.displayedRegions, {
          stopToken,
          bpPerPx,
          lodMode,
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
  // Paint-order: emit features small→large so big ribbons land on top of
  // sub-pixel noise in alpha-over compositing. Matches the standalone
  // ribbon-plot script and makes the whole-genome view legible.
  features.sort(
    (a, b) => a.get('end') - a.get('start') - (b.get('end') - b.get('start')),
  )

  const v1 = viewSnaps[level]!
  const v2 = viewSnaps[level + 1]!

  const v1Index = buildBpRegionIndex(v1)
  const v2Index = buildBpRegionIndex(v2)

  const count = features.length
  // cumBp (bpBefore + bpOffset, no padding) fits in Float64 — max 3Gbp.
  const p11Array = new Float64Array(count)
  const p12Array = new Float64Array(count)
  const p21Array = new Float64Array(count)
  const p22Array = new Float64Array(count)
  const strandsArray = new Int8Array(count)
  // bp coordinates fit in uint32 (max 4.3 Gbp).
  const startsArray = new Uint32Array(count)
  const endsArray = new Uint32Array(count)
  const mateStartsArray = new Uint32Array(count)
  const mateEndsArray = new Uint32Array(count)
  const identitiesArray = new Float32Array(count)
  const mappingQualsArray = new Float32Array(count)
  const meanScoresArray = new Float32Array(count)

  const featureIds: string[] = []
  const names: string[] = []
  const refNames: string[] = []
  const assemblyNames: string[] = []
  const mateRefNames: string[] = []
  const mateAssemblyNames: string[] = []
  const parsedCigars: Uint32Array[] = []
  let hasCigar = false
  // Viewport culling: skip features entirely outside the visible area in
  // both views. A synteny parallelogram is visible when at least one of its
  // edges (top=view1, bottom=view2) overlaps the viewport.
  const viewWidth = v1.width
  const v1Offset = v1.offsetPx
  const v2Offset = v2.offsetPx
  const bpPerPxInv1 = 1 / v1.bpPerPx
  const bpPerPxInv2 = 1 / v2.bpPerPx
  const bufferPx = viewWidth * 0.5
  const offScreenLeftBound = -bufferPx
  const offScreenRightBound = viewWidth + bufferPx

  const v1RefNames = v1Index.entries
  const v2RefNames = v2Index.entries
  const stopTokenChecker = createStopTokenChecker(stopToken)
  let validCount = 0
  for (const f of features) {
    checkStopToken2(stopTokenChecker)
    const refName = f.get('refName')
    const mate = f.get('mate') as {
      start: number
      end: number
      refName: string
      assemblyName: string
    }
    // Whole-genome PAF at low zoom: most features are on refNames not in the
    // displayed regions of one or both views. Skip before any bpToCumBp
    // arithmetic.
    if (!v1RefNames.has(refName) || !v2RefNames.has(mate.refName)) {
      continue
    }

    const strand = f.get('strand')!
    const start = f.get('start')
    const end = f.get('end')
    const f1s = strand === -1 ? end : start
    const f1e = strand === -1 ? start : end

    const p11 = bpToCumBp(v1Index, refName, f1s)
    const p12 = bpToCumBp(v1Index, refName, f1e)
    const p21 = bpToCumBp(v2Index, mate.refName, mate.start)
    const p22 = bpToCumBp(v2Index, mate.refName, mate.end)

    if (p11 === undefined || p12 === undefined || p21 === undefined || p22 === undefined) {
      continue
    }

    // Cull features where BOTH view projections are entirely off-screen.
    // Convert cumBp to screen px for the check.
    const topMinX = Math.min(p11, p12) * bpPerPxInv1 - v1Offset
    const topMaxX = Math.max(p11, p12) * bpPerPxInv1 - v1Offset
    const botMinX = Math.min(p21, p22) * bpPerPxInv2 - v2Offset
    const botMaxX = Math.max(p21, p22) * bpPerPxInv2 - v2Offset

    const topOffScreen =
      topMaxX < offScreenLeftBound || topMinX > offScreenRightBound
    const botOffScreen =
      botMaxX < offScreenLeftBound || botMinX > offScreenRightBound

    if (topOffScreen && botOffScreen) {
      continue
    }

    p11Array[validCount] = p11
    p12Array[validCount] = p12
    p21Array[validCount] = p21
    p22Array[validCount] = p22
    strandsArray[validCount] = strand
    startsArray[validCount] = start
    endsArray[validCount] = end

    const identity = f.get('identity') as number | undefined
    identitiesArray[validCount] = identity ?? -1
    mappingQualsArray[validCount] =
      (f.get('mappingQual') as number | undefined) ?? -1
    meanScoresArray[validCount] =
      (f.get('meanScore') as number | undefined) ?? -1

    mateStartsArray[validCount] = mate.start
    mateEndsArray[validCount] = mate.end

    featureIds.push(f.id())
    names.push(f.get('name') ?? '')
    refNames.push(refName)
    assemblyNames.push((f.get('assemblyName') as string | undefined) ?? '')
    mateRefNames.push(mate.refName)
    mateAssemblyNames.push(mate.assemblyName)
    // Only parse the CIGAR when it will actually be visited. Chromosome-scale
    // alignments can carry multi-megabyte CIGAR strings (~4 bytes/op in the
    // parsed Uint32Array, so tens of MB per feature). Gate matches the
    // willDrawCigar predicate in buildSyntenyGeometry — drawCIGAR off or
    // alignment narrower than minCigarPxWidth=4 means the visitor never fires,
    // and addLocationMarkers operates on bp coords without needing the CIGAR.
    const cigarStr = f.get('CIGAR') as string | undefined
    if (cigarStr) {
      hasCigar = true
    }
    const widthPx0 = topMaxX - topMinX
    const widthPx1 = botMaxX - botMinX
    const willNeedCigar =
      !!cigarStr && drawCIGAR && Math.max(widthPx0, widthPx1) >= 4
    parsedCigars.push(willNeedCigar ? parseCigar2Typed(cigarStr) : EMPTY_CIGAR)

    validCount++
  }

  // cumBp arrays are intermediate buffers consumed only by buildSyntenyGeometry
  // below. They never leave the worker — the main thread reads bp-space hi/lo
  // pairs out of `instanceData`.
  const p11_cumBp = p11Array.subarray(0, validCount)
  const p12_cumBp = p12Array.subarray(0, validCount)
  const p21_cumBp = p21Array.subarray(0, validCount)
  const p22_cumBp = p22Array.subarray(0, validCount)

  const featureData = {
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    mappingQuals: mappingQualsArray.subarray(0, validCount),
    meanScores: meanScoresArray.subarray(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    mateStarts: mateStartsArray.subarray(0, validCount),
    mateEnds: mateEndsArray.subarray(0, validCount),
    mateRefNames,
    mateAssemblyNames,
    hasCigar,
  }

  // colorBy lives on the main thread; the worker emits geometry +
  // per-instance `kinds`/`instanceFeatureIdx` descriptors, and the display
  // model recomputes `colors` on colorBy change without an RPC round-trip.

  const instanceData = await updateStatus(
    'Computing synteny layout',
    statusCallback,
    () =>
      buildSyntenyGeometry({
        p11_cumBp,
        p12_cumBp,
        p21_cumBp,
        p22_cumBp,
        strands: featureData.strands,
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

  return rpcResult({ ...featureData, instanceData }, [
    featureData.strands.buffer,
    featureData.starts.buffer,
    featureData.ends.buffer,
    featureData.identities.buffer,
    featureData.mappingQuals.buffer,
    featureData.meanScores.buffer,
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
    instanceData.alignmentLengths.buffer,
  ] as ArrayBuffer[])
}
