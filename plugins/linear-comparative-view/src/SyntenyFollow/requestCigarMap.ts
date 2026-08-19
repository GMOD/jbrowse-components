import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'

import type {
  FeatPos,
  LinearSyntenyDisplayModel,
} from '../LinearSyntenyDisplay/model.ts'

/**
 * The CIGAR map for one picked block, asked for once and then read every frame.
 *
 * ONCE PER BLOCK, WHERE `resolveMatchingSpan` IS ONCE PER WINDOW. That is the
 * whole difference between them and the reason both exist: a settle asks the
 * resolve where THIS window goes, and the answer is three numbers that say
 * nothing about the next window; this asks what the block does, and every window
 * inside it is then arithmetic the main thread can do at 60fps.
 *
 * Reads `lodTier` like the resolve does, and for the same reason — feature ids
 * are only comparable within one tier, so a map asked for at the wrong one comes
 * back `undefined` rather than wrong. Both callers are past their autorun's
 * first `await`, so neither read is tracked.
 *
 * No refName goes out or comes back: the regions carry `feat.refName`, which is
 * canonical and which `RpcMethodTypeWithRenameRegions` maps back into the
 * adapter's namespace on the way out, and the result is offsets.
 */
export async function requestCigarMap({
  model,
  feat,
}: {
  model: LinearSyntenyDisplayModel
  feat: FeatPos
}) {
  const { rpcManager } = getSession(model)
  return rpcManager.call(
    getRpcSessionId(model),
    'SyntenyGetCigarMap',
    // eslint-disable-next-line no-restricted-syntax
    {
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
