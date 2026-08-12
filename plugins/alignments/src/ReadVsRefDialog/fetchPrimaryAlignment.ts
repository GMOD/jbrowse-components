import {
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'
import { getSequenceAdapterConfig } from '@jbrowse/core/assemblyManager/assembly'
import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getTag } from '@jbrowse/modifications-utils'

import type { AbstractTrackModel, Feature } from '@jbrowse/core/util'

/**
 * The primary alignment of the split read `preFeature` belongs to, fetched over
 * RPC when `preFeature` is itself a supplementary.
 *
 * Every read-vs-ref launcher resolves this first so the read coordinate system
 * is the same whichever segment of the read was clicked: `featurizeSA`
 * normalizes SA entries into the *query's* reference orientation, so anchoring
 * on a supplementary that happens to be on the opposite strand from the primary
 * silently reverses the whole read axis. The primary is also the only record
 * carrying the full SEQ, which the linear view's read sequence track needs.
 */
export async function fetchPrimaryAlignment(
  track: AbstractTrackModel,
  preFeature: Feature,
) {
  if (!((preFeature.get('flags') as number) & SAM_FLAG_SUPPLEMENTARY)) {
    return preFeature
  }
  const SA = (getTag(preFeature, 'SA') as string | undefined) ?? ''
  const primaryAln = SA.split(';', 1)[0]!
  const [saRef, saStart] = primaryAln.split(',')
  // A supplementary read without an SA tag has nothing pointing at its primary.
  // Said here rather than walked into: `+undefined` is NaN, which used to reach
  // the adapter as a NaN-bounded region and come back as "primary feature not
  // found" — the same message a genuinely missing primary gives.
  if (!saRef || !saStart) {
    throw new Error(
      'Supplementary alignment carries no SA tag, so its primary alignment cannot be located',
    )
  }
  const session = getSession(track)
  const { rpcManager } = session
  const adapterConfig = getConf(track, 'adapter')
  const sessionId = getRpcSessionId(track)
  const [asm] = getConf(track, 'assemblyNames') as string[]
  // CRAM/BAM must decode the primary read's SEQ against the reference; the
  // adapter config doesn't carry it, so pass the assembly's sequence adapter.
  const sequenceAdapter = getSequenceAdapterConfig(
    asm ? session.assemblyManager.get(asm) : undefined,
  )
  const feats: Feature[] = await rpcManager.call(sessionId, 'CoreGetFeatures', {
    adapterConfig,
    sequenceAdapter,
    regions: [
      {
        refName: saRef,
        start: +saStart - 1,
        end: +saStart,
        assemblyName: asm ?? '',
      },
    ],
  })
  const result = feats.find(
    f =>
      f.get('name') === preFeature.get('name') &&
      !((f.get('flags') as number) & SAM_FLAG_SUPPLEMENTARY) &&
      !((f.get('flags') as number) & SAM_FLAG_SECONDARY),
  )
  if (!result) {
    throw new Error('primary feature not found')
  }
  return result
}
