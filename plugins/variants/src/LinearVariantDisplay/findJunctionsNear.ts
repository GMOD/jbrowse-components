import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { junctionFromFeature } from '@jbrowse/sv-core'

import type { Feature } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { FindJunctionsNear, Junction } from '@jbrowse/sv-core'

/**
 * The `findJunctionsNear` a variant display hands `launchBreakpointSplitView`,
 * so its dialog can offer to open a whole chain of co-located junctions instead
 * of the clicked record's own two ends.
 *
 * It queries the display's ADAPTER rather than reading the features the display
 * has loaded, and it has to: the locus a chain hops to is by definition
 * somewhere the view is not, so the records that continue the chain were never
 * fetched for the screen. The window is two kilobases, which for a tabix VCF is
 * one block read.
 *
 * Symbolic SVs come back as junctions too, since `parseSvAlt` reads CHR2/END, so
 * a chain running through a `<DEL>` or `<DUP>` record is followed the same way a
 * BND one is.
 */
export function makeFindJunctionsNear(
  self: IStateTreeNode & { adapterConfig: Record<string, unknown> },
  assemblyName: string,
): FindJunctionsNear {
  return async region => {
    const { rpcManager } = getSession(self)
    const features = (await rpcManager.call(
      getRpcSessionId(self),
      'CoreGetFeatures',
      {
        adapterConfig: self.adapterConfig,
        regions: [{ ...region, assemblyName }],
      },
    )) as Feature[]
    return features
      .map(f => junctionFromFeature(f))
      .filter((j): j is Junction => j !== undefined)
  }
}
