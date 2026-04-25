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
import {
  bpInRegionFromIndex,
  buildBpInRegionIndex,
} from '@jbrowse/core/util/bpProjection'

import type { SyntenyInstanceData } from './buildSyntenyGeometry.ts'
import type { SyntenyFeatureData } from '../LinearSyntenyDisplay/model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ViewSnap } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

export interface SyntenyRpcResult extends SyntenyFeatureData {
  instanceData: SyntenyInstanceData
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
  chainMerge = false,
  statusCallback,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  viewSnaps: ViewSnap[]
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

  const v1Index = buildBpInRegionIndex(v1.displayedRegions)
  const v2Index = buildBpInRegionIndex(v2.displayedRegions)

  const count = processedFeatures.length
  const p11Array = new Uint32Array(count)
  const p12Array = new Uint32Array(count)
  const p21Array = new Uint32Array(count)
  const p22Array = new Uint32Array(count)
  const topRegionIdxArray = new Uint8Array(count)
  const botRegionIdxArray = new Uint8Array(count)
  const strandsArray = new Int8Array(count)
  const startsArray = new Float64Array(count)
  const endsArray = new Float64Array(count)
  const identitiesArray = new Float64Array(count)

  const featureIds: string[] = []
  const names: string[] = []
  const refNames: string[] = []
  const assemblyNames: string[] = []
  const cigars: string[] = []
  const precomputedSyriTypes: (string | undefined)[] = []
  const mates: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }[] = []

  const stopTokenChecker = createStopTokenChecker(stopToken)
  let validCount = 0
  for (const f of processedFeatures) {
    checkStopToken2(stopTokenChecker)
    const strand = f.get('strand') as number
    const mate = f.get('mate') as {
      start: number
      end: number
      refName: string
      name: string
      assemblyName: string
    }
    const refName = f.get('refName') as string
    const start = f.get('start') as number
    const end = f.get('end') as number

    let f1s = start
    let f1e = end
    if (strand === -1) {
      ;[f1e, f1s] = [f1s, f1e]
    }

    const p11 = bpInRegionFromIndex(v1Index, refName, f1s)
    const p12 = bpInRegionFromIndex(v1Index, refName, f1e)
    const p21 = bpInRegionFromIndex(v2Index, mate.refName, mate.start)
    const p22 = bpInRegionFromIndex(v2Index, mate.refName, mate.end)

    if (
      p11 === undefined ||
      p12 === undefined ||
      p21 === undefined ||
      p22 === undefined
    ) {
      continue
    }
    // Drop straddlers: feature spans across two displayed regions on the same
    // side. Rare (only when same refName appears as ≥2 displayedRegions and a
    // single record crosses between them). Cleaner to skip than to misrender
    // into the inter-region pad. See agent-docs/SYNTENY_BP_REFACTOR.md.
    if (p11.regionIdx !== p12.regionIdx || p21.regionIdx !== p22.regionIdx) {
      continue
    }

    p11Array[validCount] = p11.bpInRegion
    p12Array[validCount] = p12.bpInRegion
    p21Array[validCount] = p21.bpInRegion
    p22Array[validCount] = p22.bpInRegion
    topRegionIdxArray[validCount] = p11.regionIdx
    botRegionIdxArray[validCount] = p21.regionIdx
    strandsArray[validCount] = strand
    startsArray[validCount] = start
    endsArray[validCount] = end

    const identity = f.get('identity') as number | undefined
    identitiesArray[validCount] = identity ?? -1

    featureIds.push(f.id())
    names.push((f.get('name') as string | undefined) ?? '')
    refNames.push(refName)
    assemblyNames.push((f.get('assemblyName') as string | undefined) ?? '')
    cigars.push((f.get('CIGAR') as string | undefined) ?? '')
    precomputedSyriTypes.push(f.get('syriType') as string | undefined)
    mates.push(mate)

    validCount++
  }

  const positionData = {
    p11_bp: p11Array.subarray(0, validCount),
    p12_bp: p12Array.subarray(0, validCount),
    p21_bp: p21Array.subarray(0, validCount),
    p22_bp: p22Array.subarray(0, validCount),
    topRegionIdx: topRegionIdxArray.subarray(0, validCount),
    botRegionIdx: botRegionIdxArray.subarray(0, validCount),
    strands: strandsArray.subarray(0, validCount),
    starts: startsArray.subarray(0, validCount),
    ends: endsArray.subarray(0, validCount),
    identities: identitiesArray.subarray(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    cigars,
    syriTypes: precomputedSyriTypes,
    mates,
  }

  const parsedCigars = cigars.map(s => (s ? parseCigar2(s) : []))

  const instanceData = await updateStatus(
    'Computing synteny layout',
    statusCallback,
    () =>
      buildSyntenyGeometry({
        ...positionData,
        parsedCigars,
        drawCIGAR,
        drawCIGARMatchesOnly,
      }),
  )
  const result = {
    ...positionData,
    instanceData,
  }

  return rpcResult(result, [
    result.p11_bp.buffer,
    result.p12_bp.buffer,
    result.p21_bp.buffer,
    result.p22_bp.buffer,
    result.topRegionIdx.buffer,
    result.botRegionIdx.buffer,
    result.strands.buffer,
    result.starts.buffer,
    result.ends.buffer,
    result.identities.buffer,
    instanceData.x1.buffer,
    instanceData.x2.buffer,
    instanceData.x3.buffer,
    instanceData.x4.buffer,
    instanceData.topRegionIdx.buffer,
    instanceData.botRegionIdx.buffer,
    instanceData.colors.buffer,
    instanceData.kinds.buffer,
    instanceData.instanceFeatureIdx.buffer,
    instanceData.featureIds.buffer,
    instanceData.queryTotalLengths.buffer,
  ] as ArrayBuffer[])
}
