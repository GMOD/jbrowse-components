import { filterChainFeatures } from '../RenderAlignmentDataRPC/filterChainFeatures.ts'
import { dropsRecord } from '../shared/alignmentsFilter.ts'
import { getFlags } from '../shared/util.ts'

import type { FilterableRead } from '../shared/alignmentsFilter.ts'
import type { Feature } from '@jbrowse/core/util'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

// A read as it arrives off the RPC, serialized, in the shape the adapters
// test a record in as they parse it
function filterableReadOf(feature: Feature): FilterableRead {
  const tags = feature.get('tags') as Record<string, unknown> | undefined
  return {
    flags: getFlags(feature),
    getTag: tag => tags?.[tag],
  }
}

/**
 * The reads the pileup draws out of a fetch that applied no filter: the
 * flags and tags the adapters drop by as they parse, then the `mapq` floor and
 * the drawn-read fields the worker applies. Over the whole export at once, so
 * a chain filter counts a read's mate in any of the regions.
 */
export function exportedReads(
  features: Feature[],
  filter: readonly FieldPredicate[],
) {
  const drops = dropsRecord(filter)
  return filterChainFeatures(
    features.filter(f => !drops(filterableReadOf(f))),
    filter,
  )
}
