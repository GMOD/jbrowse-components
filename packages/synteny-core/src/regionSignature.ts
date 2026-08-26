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
 * NO ORIENTATION, which is the whole difference from `regionSignature` above
 * and is a fact about the adapter rather than an omission. A fetch hands over
 * refName/start/end; which way round the row draws them is a display property
 * that changes nothing about what comes back. Orientation still reaches both
 * fetch keys, through the `regionSignature` term that sits beside this one — so
 * flipping a row does refetch, and it does so because the cumBp index changed,
 * which is the true reason.
 *
 * Here rather than spelled twice, which is what it was: a module-private
 * `windowSignature` in `LinearSyntenyDisplay/model.ts` and the same expression
 * inline in `dotplotFetchKey`, both drifting the same way from the shared
 * function directly above them. Neither key is ever compared against the other,
 * so the drift was invisible — and a one-sided "fix" to either copy would have
 * stayed invisible too.
 */
export function fetchWindowSignature(regions: Region[]) {
  return regions.map(r => `${r.refName}:${r.start}-${r.end}`).join(',')
}
