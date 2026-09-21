import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'

/**
 * The CIGAR map for one picked block, asked for once and then read every frame.
 * `lodTier` goes with it because feature ids are comparable only within one
 * tier. The region's refName is canonical, and the RPC renames it on the way
 * out; the result is offsets.
 */
export async function requestCigarMap({
  model,
  feat,
  signal,
}: {
  model: LinearSyntenyDisplayModel
  feat: FeatPos
  // aborted with the follow store: the request re-reads the whole region
  signal: AbortSignal
}) {
  const { rpcManager } = getSession(model)
  return rpcManager.call(
    getRpcSessionId(model),
    'SyntenyGetCigarMap',
    // eslint-disable-next-line no-restricted-syntax -- reports nothing: a fire-and-forget per-block precision fetch; the display's status would flash its fetch chip once per block crossed during a drag
    {
      signal,
      adapterConfig: model.adapterConfig,
      regions: [
        {
          refName: feat.refName,
          start: feat.start,
          end: feat.end,
          assemblyName: feat.assemblyName,
        },
      ],
      featureId: feat.id,
      lodMode: model.lodTier,
    },
  )
}
