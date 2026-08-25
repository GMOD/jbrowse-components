import {
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
  splitSA,
} from '@jbrowse/cigar-utils'
import { getConf } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { getTag } from '@jbrowse/modifications-utils'

import type {
  AbstractTrackModel,
  Feature,
  StatusCallback,
} from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const PAIR_ROLE = SAM_FLAG_FIRST_IN_PAIR | SAM_FLAG_SECOND_IN_PAIR

export interface AlignmentLocus {
  refName: string
  start: number
}

function flagsOf(feature: Feature) {
  return (feature.get('flags') as number | undefined) ?? 0
}

/**
 * The leftmost base of every alignment a record's SA tag names, in tag order.
 * The primary is one of them — conventionally the first, but the spec only
 * recommends that, so a caller that needs the primary checks the rest too.
 */
export function supplementaryLoci(feature: Feature): AlignmentLocus[] {
  const SA = (getTag(feature, 'SA') as string | undefined) ?? ''
  return splitSA(SA).flatMap(record => {
    const [refName, pos] = record.split(',')
    const start = Number(pos) - 1
    return refName && Number.isInteger(start) && start >= 0
      ? [{ refName, start }]
      : []
  })
}

/**
 * The primary alignment of `preFeature`'s read among fetched records. Name
 * alone does not identify it: a mate shares the QNAME, is neither supplementary
 * nor secondary, and overlaps the primary's first base whenever the fragment is
 * shorter than two reads, which a one-base fetch at that locus then returns
 * first. The pair role separates the two.
 */
export function pickPrimaryAlignment(
  feats: Feature[],
  preFeature: Feature,
): Feature | undefined {
  const name = preFeature.get('name')
  const role = flagsOf(preFeature) & PAIR_ROLE
  return feats.find(f => {
    const flags = flagsOf(f)
    return (
      f.get('name') === name &&
      !(flags & (SAM_FLAG_SUPPLEMENTARY | SAM_FLAG_SECONDARY)) &&
      (flags & PAIR_ROLE) === role
    )
  })
}

/**
 * How many SA loci past the first the fallback fetch will try. A record's SA
 * tag has no ceiling — a real ngmlr-aligned ONT record in COLO829 carries 943
 * entries — and every locus is its own index query, so past this the search
 * reports what it did not look at rather than issuing hundreds of fetches for
 * a primary the aligner did not file where the spec says it should be.
 */
export const MAX_FALLBACK_LOCI = 16

/**
 * Resolve a split read to its primary alignment. A non-supplementary record is
 * already that. For a supplementary, the SA tag's first locus is tried first,
 * then the next `MAX_FALLBACK_LOCI` it names in one fetch, so an aligner that
 * does not file the primary first still resolves.
 */
export async function resolvePrimaryAlignment(
  preFeature: Feature,
  fetchAt: (loci: AlignmentLocus[]) => Promise<Feature[]>,
) {
  if (!(flagsOf(preFeature) & SAM_FLAG_SUPPLEMENTARY)) {
    return preFeature
  }
  const [first, ...rest] = supplementaryLoci(preFeature)
  if (!first) {
    throw new Error(
      'Supplementary alignment carries no SA tag, so its primary alignment cannot be located',
    )
  }
  const fallback = rest.slice(0, MAX_FALLBACK_LOCI)
  const result =
    pickPrimaryAlignment(await fetchAt([first]), preFeature) ??
    (fallback.length > 0
      ? pickPrimaryAlignment(await fetchAt(fallback), preFeature)
      : undefined)
  if (!result) {
    const searched = 1 + fallback.length
    const total = 1 + rest.length
    throw new Error(
      searched < total
        ? `primary feature not found at the first ${searched} of the ${total} loci in the SA tag`
        : 'primary feature not found',
    )
  }
  return result
}

/**
 * `resolvePrimaryAlignment` over the track's adapter. Every read-vs-ref
 * launcher resolves this first so the read coordinate system is the same
 * whichever segment was clicked: `featurizeSA` normalizes SA entries into the
 * query's reference orientation, so anchoring on a supplementary on the
 * opposite strand from the primary silently reverses the whole read axis. The
 * primary is also the only record carrying the full SEQ.
 */
export async function fetchPrimaryAlignment(
  track: AbstractTrackModel,
  preFeature: Feature,
  opts: { stopToken?: StopToken; statusCallback?: StatusCallback } = {},
) {
  return resolvePrimaryAlignment(preFeature, async loci => {
    const { rpcManager, assemblyManager } = getSession(track)
    const [asm] = getConf(track, 'assemblyNames') as string[]
    // An SA refName is the file's own spelling. The RPC renames a region from
    // the assembly's canonical name into the adapter's, so it is put into the
    // canonical namespace first rather than relying on that rename missing.
    const assembly = asm
      ? await assemblyManager.waitForAssembly(asm)
      : undefined
    const canonical = (refName: string) =>
      assembly?.getCanonicalRefName2(refName) ?? refName
    return rpcManager.call(getRpcSessionId(track), 'CoreGetFeatures', {
      adapterConfig: getConf(track, 'adapter'),
      regions: loci.map(({ refName, start }) => ({
        refName: canonical(refName),
        start,
        end: start + 1,
        assemblyName: asm ?? '',
      })),
      ...opts,
    })
  })
}
