import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export async function fetchSequence(
  model: IAnyStateTreeNode,
  regions: Region[],
) {
  const session = getSession(model)
  const assemblyNames = new Set(regions.map(r => r.assemblyName))
  if (assemblyNames.size > 1) {
    throw new Error(
      'not able to fetch sequences from multiple assemblies currently',
    )
  }
  const { rpcManager, assemblyManager } = session
  const assemblyName = regions[0]?.assemblyName
  if (!assemblyName) {
    throw new Error('no assemblyName found on the selected region')
  }
  const assembly = assemblyManager.get(assemblyName)
  if (!assembly) {
    throw new Error(`assembly ${assemblyName} not found`)
  }
  const adapterConfig = getConf(assembly, ['sequence', 'adapter'])

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
  })
}
