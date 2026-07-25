import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * Which detail tier a synteny track in a plain LGV should fetch.
 *
 * The tiered PIF adapters resolve this themselves from `bpPerPx` when asked for
 * `auto`, but the alignments fetch path a synteny track goes through in an LGV
 * passes no `bpPerPx` — so left alone they always land on the fine per-row-CIGAR
 * tier, and a whole-genome one-vs-all view reads every CIGAR in the file. The
 * display resolves the tier instead and sends the answer.
 *
 * Resolving here rather than forwarding `bpPerPx` is deliberate: this value goes
 * into `rpcProps`, which is the refetch cache key, so a raw `bpPerPx` would
 * invalidate every fetch on every zoom step. The tier changes only when it
 * flips.
 *
 * An adapter with no tiering has no threshold slot, so `undefined` in means
 * `undefined` out — the fetch then carries no `lodMode` and behaves as it did
 * before this existed.
 */
export function resolveDisplayLodMode({
  bpPerPx,
  coarseBpPerPxThreshold,
}: {
  bpPerPx: number
  coarseBpPerPxThreshold: number | undefined
}): BaseOptions['lodMode'] {
  return coarseBpPerPxThreshold === undefined
    ? undefined
    : bpPerPx >= coarseBpPerPxThreshold
      ? 'coarse'
      : 'fine'
}
