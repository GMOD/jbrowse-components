import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { failureNotice } from '../RenderFeatureDataRPC/proteinFeatures.ts'

import type { RenderFeatureDataArgs } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

type ProteinFeaturesArg = NonNullable<RenderFeatureDataArgs['proteinFeatures']>

/**
 * The `proteinFeatures` arg for one region's fetch, with the region's contig
 * as the domain file spells it, resolved here because a worker has no
 * aliases; or the notice for a domain file whose names could not be read.
 */
export async function proteinFeaturesFor(
  self: IStateTreeNode,
  arg: Omit<ProteinFeaturesArg, 'refName'>,
  region: Region,
  signal: AbortSignal,
): Promise<{ arg?: ProteinFeaturesArg; notice?: string }> {
  try {
    const names = await getSession(
      self,
    ).assemblyManager.getRefNameMapForAdapter(
      arg.adapter,
      region.assemblyName,
      { sessionId: getRpcSessionId(self), signal },
    )
    return { arg: { ...arg, refName: names[region.refName] ?? region.refName } }
  } catch (error) {
    return { notice: failureNotice(error) }
  }
}
