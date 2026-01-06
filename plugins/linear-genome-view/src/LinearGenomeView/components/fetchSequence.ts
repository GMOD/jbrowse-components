import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'

import type { BpOffset } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'
import type { Region } from '@jbrowse/core/util/types'

export async function fetchSequence(
  model: {
    leftOffset?: BpOffset
    rightOffset?: BpOffset
    getSelectedRegions: (left?: BpOffset, right?: BpOffset) => Region[]
    setOffsets: (left?: BpOffset, right?: BpOffset) => void
  },
  regions: Region[],
) {
  const session = getSession(model)
  const { leftOffset, rightOffset } = model

  if (!leftOffset || !rightOffset) {
    throw new Error('no offsets on model to use for range')
  }

  const assemblyNames = new Set(regions.map(r => r.assemblyName))
  if (assemblyNames.size > 1) {
    throw new Error(
      'not able to fetch sequences from multiple assemblies currently',
    )
  }
  const { rpcManager, assemblyManager } = session
  const assemblyName = leftOffset.assemblyName || rightOffset.assemblyName || ''
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  const adapterConfig = getConf(assembly, ['sequence', 'adapter'])

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    sessionId,
  }) as Promise<Feature[]>
}
