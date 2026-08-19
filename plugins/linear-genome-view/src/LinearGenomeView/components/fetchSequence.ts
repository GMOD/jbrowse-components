import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import { getSession } from '@jbrowse/core/util'

import type { StatusCallback } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Region } from '@jbrowse/core/util/types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export async function fetchSequence(
  model: IAnyStateTreeNode,
  regions: Region[],
  opts: { stopToken?: StopToken; statusCallback?: StatusCallback } = {},
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
  // Undefined here means the assembly's `configuration` safeReference is
  // unresolved — the assembly outlived the config entry it points at. NOT an
  // assembly whose sequence carries no residues: a ChromSizesAdapter one still
  // has a `sequence.adapter`, and fails later, inside the adapter. Say which
  // this is; passing the undefined on fails in getAdapterPre as "could not
  // determine adapter type", naming neither the assembly nor what was wanted.
  const adapterConfig = getSequenceAdapterConfig(assembly)
  if (!adapterConfig) {
    throw new Error(
      `assembly ${assemblyName} has no resolved configuration, so its sequence adapter cannot be read`,
    )
  }

  const sessionId = 'getSequence'
  return rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    regions,
    ...opts,
  })
}
