import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import { rpcResult } from '@jbrowse/core/util/librpc'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region, ViewSnap } from '@jbrowse/core/util'

export function executeSyntenyFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  viewSnaps,
  level,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  viewSnaps: ViewSnap[]
  level: number
}) {
  return _executeSyntenyFeaturesAndPositions({
    pluginManager,
    sessionId,
    adapterConfig,
    regions,
    viewSnaps,
    level,
  })
}

async function _executeSyntenyFeaturesAndPositions({
  pluginManager,
  sessionId,
  adapterConfig,
  regions,
  viewSnaps,
  level,
}: {
  pluginManager: PluginManager
  sessionId: string
  adapterConfig: Record<string, unknown>
  regions: Region[]
  viewSnaps: ViewSnap[]
  level: number
}) {
  const dataAdapter = (await getAdapter(pluginManager, sessionId, adapterConfig))
    .dataAdapter as BaseFeatureDataAdapter

  const features = await firstValueFrom(
    dataAdapter.getFeaturesInMultipleRegions(regions, {}).pipe(toArray()),
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

  const featureIds: string[] = []
  const names: string[] = []
  const refNames: string[] = []
  const assemblyNames: string[] = []
  const cigars: string[] = []
  const mates: { start: number; end: number; refName: string; name: string; assemblyName: string }[] = []

  let validCount = 0
  for (const f of features) {
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

    const refName1 = refName
    const refName2 = mate.refName

    const p11 = bpToPx({ self: v1, refName: refName1, coord: f1s })
    const p12 = bpToPx({ self: v1, refName: refName1, coord: f1e })
    const p21 = bpToPx({ self: v2, refName: refName2, coord: mate.start })
    const p22 = bpToPx({ self: v2, refName: refName2, coord: mate.end })

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

  const result = {
    p11_offsetPx: p11Array.slice(0, validCount),
    p12_offsetPx: p12Array.slice(0, validCount),
    p21_offsetPx: p21Array.slice(0, validCount),
    p22_offsetPx: p22Array.slice(0, validCount),
    strands: strandsArray.slice(0, validCount),
    starts: startsArray.slice(0, validCount),
    ends: endsArray.slice(0, validCount),
    identities: identitiesArray.slice(0, validCount),
    featureIds,
    names,
    refNames,
    assemblyNames,
    cigars,
    mates,
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
  ] as ArrayBuffer[])
}
