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
 *
 * **It answers with the records filed AT the window, which is not the same as
 * every record with an end there.** A tabix index knows one coordinate per
 * record, so a BND filed at chr1 naming a mate on chr2 is unreachable from any
 * query about chr2 — and that is the record the walk needs to extend backward
 * past its starting locus. Two things supply it instead, and between them cover
 * every callset in the tree: a reciprocal BND pair, which is how VCF 4.x writes
 * a breakend and what every caller here emits, and an adapter that files a row
 * under both of its contigs and hands back a feature anchored at whichever end
 * was queried (`BedpeAdapter`, `StarFusionAdapter`).
 *
 * What neither covers — a filtered VCF that dropped one mate, a one-record
 * `<TRA>` naming CHR2 — cannot be fixed here. Finding a record by its MATE
 * coordinate is a scan of the whole callset, and this runs against whatever
 * adapter a variant display holds: a somatic SV VCF is a few hundred records
 * and a germline one is tens of millions, with nothing in an `adapterConfig` to
 * tell them apart. A chain through such a record ends early rather than
 * wrongly, which is the behaviour to keep if the alternative is reading a file
 * that size to draw four panels.
 */
export function makeFindJunctionsNear(
  self: IStateTreeNode & { adapterConfig: Record<string, unknown> },
  assemblyName: string,
): FindJunctionsNear {
  return async region => {
    const { rpcManager, assemblyManager } = getSession(self)
    // require, not wait: without it the junctions this returns would carry raw
    // refNames, which match nothing the walk compares them to, so the chain
    // would read as having simply ended rather than as having failed.
    const assembly = await assemblyManager.requireAssembly(assemblyName)
    const features = await rpcManager.call(
      getRpcSessionId(self),
      'CoreGetFeatures',
      // Neither handle, and there is nowhere to put either. A hop reads one
      // 2kb window either side of a breakend and the walk stops at four of
      // them, so there is no long phase to narrate; and the choice dialog that
      // starts the walk closes before it runs (see its `handleClose`, which
      // fires beside the unawaited launch), so there is no cancel to honor
      // either. Give this one a surface — a dialog that stays up while the
      // chain resolves — and it wants both, through `FindJunctionsNear`.
      // eslint-disable-next-line no-restricted-syntax
      {
        adapterConfig: self.adapterConfig,
        regions: [{ ...region, assemblyName }],
      },
    )
    return features
      .map(f => junctionFromFeature(f, assembly))
      .filter((j): j is Junction => j !== undefined)
  }
}
