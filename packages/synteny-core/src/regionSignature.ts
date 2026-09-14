import type { Region } from '@jbrowse/core/util'

// Stable string identifying a region set's contents, order and orientation —
// the three things a comparative view's cumBp index is built from, so a change
// in any of them invalidates held feature data. Used by both the dotplot fetch
// key and the synteny display's `regionSignature`.
//
// Only ever compared against another output of this function (never persisted),
// so the separators are arbitrary; they just have to be characters a refName
// cannot contain.
export function regionSignature(regions: Region[]) {
  return regions
    .map(r => `${r.refName}:${r.start}:${r.end}:${r.reversed ? 1 : 0}`)
    .join('|')
}

/**
 * Stable string identifying the WINDOW a comparative fetch asks the adapter
 * for — the snapped, buffer-expanded regions, not the displayed ones.
 *
 * NO ORIENTATION, the one difference from `regionSignature` above, because the
 * adapter's answer does not depend on it. A fetch hands over
 * refName/start/end; which way round the row draws them is a display property
 * that changes nothing about what comes back. Orientation still reaches both
 * fetch keys, through the `regionSignature` term that sits beside this one — so
 * flipping a row does refetch, because the cumBp index changed.
 *
 * Defined here once. It was spelled twice: a module-private
 * `windowSignature` in `LinearSyntenyDisplay/model.ts` and the same expression
 * inline in `dotplotFetchKey`, both drifting the same way from the shared
 * function directly above them. Neither key is ever compared against the other,
 * so no test or runtime check caught the drift, or would have caught a
 * one-sided "fix" to either copy.
 */
export function fetchWindowSignature(regions: Region[]) {
  return regions.map(r => `${r.refName}:${r.start}-${r.end}`).join(',')
}
