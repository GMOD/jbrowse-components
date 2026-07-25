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
