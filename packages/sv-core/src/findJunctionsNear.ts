import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import { junctionFromFeature } from './walkBreakendChain.ts'

import type { FindJunctionsNear, Junction } from './walkBreakendChain.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The `findJunctionsNear` a display hands `launchBreakpointSplitView`,
 * so its dialog can offer to open a whole chain of co-located junctions instead
 * of the clicked record's own two ends.
 *
 * It queries the display's ADAPTER rather than reading the features the display
 * has loaded, and it has to: the locus a chain hops to is by definition
 * somewhere the view is not, so the records that continue the chain were never
 * fetched for the screen. The window is a couple of kilobases, which for a tabix
 * VCF is one block read.
 *
 * Lives here rather than in `plugins/variants` because the launch sites are in
 * different plugins — the variant display's right-click and the SV inspector's
 * chord click — and both already depend on this package. Any model exposing an
 * `adapterConfig` over a record-bearing file can supply one.
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
    const features = await rpcManager.call(
      getRpcSessionId(self),
      'CoreGetFeatures',
      {
        adapterConfig: self.adapterConfig,
        regions: [{ ...region, assemblyName }],
      },
    )
    return features
      .map(f => junctionFromFeature(f))
      .filter((j): j is Junction => j !== undefined)
  }
}
