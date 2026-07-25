import { SAM_FLAG_SECONDARY } from '@jbrowse/alignments-core'

import { getFlags } from './util.ts'

import type { Feature } from '@jbrowse/core/util'

/**
 * The key that groups alignments into a single chain (shared row + connecting
 * line + overlap tint) in view-as-pairs / link-supplementary mode. Mates and
 * supplementary (split) segments of a read share its QNAME and chain together.
 *
 * A secondary alignment (0x100) is a competing mapping of the *same* read bases
 * to a different locus — it is neither a mate nor a split segment — so it must
 * never join its primary's chain. Chaining it would force it onto the primary's
 * row and draw a connecting line spanning to it (common with RNA-seq
 * multimappers). Keying each secondary by its globally-unique feature id gives
 * it its own singleton chain, rendered standalone. This matches IGV (which
 * excludes secondary from both pairing and supplementary linking) and this
 * plugin's own connection resolver (readGroupConnections, which already drops
 * secondary). The '\0' prefix cannot collide with a real QNAME.
 */
export function chainGroupingKey(name: string, id: string, flags: number) {
  return flags & SAM_FLAG_SECONDARY ? `\0${id}` : name
}

/**
 * `chainGroupingKey` for a raw fetched feature — the form both by-name grouping
 * sites over `Feature`s (`partitionChains`, `filterChainFeatures`) need, so
 * neither re-spells the field reads. A missing QNAME falls back to '', collapsing
 * such reads into one shared chain; acceptable since QNAME is mandatory in SAM and
 * linked-read data always carries it. (`buildChainMetadata` works from already
 * extracted `ChainFeatureData`, so it calls `chainGroupingKey` directly.)
 */
export function featureChainKey(feature: Feature) {
  return chainGroupingKey(
    feature.get('name') ?? '',
    feature.id(),
    getFlags(feature),
  )
}
