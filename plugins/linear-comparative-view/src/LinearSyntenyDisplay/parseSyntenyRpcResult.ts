import { parseCigar } from '@jbrowse/plugin-alignments'

import type { FeatPos } from './model.ts'
import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

export type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

export interface SyntenyRpcResult {
  p11_offsetPx: Float64Array
  p12_offsetPx: Float64Array
  p21_offsetPx: Float64Array
  p22_offsetPx: Float64Array
  strands: Int8Array
  starts: Float64Array
  ends: Float64Array
  identities: Float64Array
  padTop: Float64Array
  padBottom: Float64Array
  featureIds: string[]
  names: string[]
  refNames: string[]
  assemblyNames: string[]
  cigars: string[]
  mates: {
    start: number
    end: number
    refName: string
    name: string
    assemblyName: string
  }[]
  instanceData: SyntenyInstanceData
}

export function parseSyntenyRpcResult(result: SyntenyRpcResult) {
  const map: FeatPos[] = []
  for (let i = 0; i < result.featureIds.length; i++) {
    const identity = result.identities[i]!
    map.push({
      p11: { offsetPx: result.p11_offsetPx[i]! },
      p12: { offsetPx: result.p12_offsetPx[i]! },
      p21: { offsetPx: result.p21_offsetPx[i]! },
      p22: { offsetPx: result.p22_offsetPx[i]! },
      padTop: result.padTop[i]!,
      padBottom: result.padBottom[i]!,
      id: result.featureIds[i]!,
      strand: result.strands[i]!,
      name: result.names[i]!,
      refName: result.refNames[i]!,
      start: result.starts[i]!,
      end: result.ends[i]!,
      assemblyName: result.assemblyNames[i]!,
      mate: result.mates[i]!,
      cigar: parseCigar(result.cigars[i]),
      identity: identity === -1 ? undefined : identity,
    })
  }
  return map
}
