import { readConfObject } from '@jbrowse/core/configuration'
import { canonicalAssemblyNames } from '@jbrowse/core/util/tracks'

import { isSyntenyTrack } from './getSyntenyTracks.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type {
  AssemblyNameResolver,
  SessionAssemblies,
} from '@jbrowse/core/util/tracks'

/**
 * The assembly rows a synteny track implies, for the import forms' "Quick
 * start" mode. A pairwise track fills two rows; an all-vs-all track (more than
 * two assemblyNames) stacks every assembly it lists as a row, with the single
 * track backing every adjacent band. A self-alignment track names the same
 * assembly twice; that repeat is meaningful (it is what makes the pair
 * launchable) so it is kept rather than deduplicated.
 *
 * **Canonical**, like every other name the import forms put in a row. A track
 * config is free to name an alias, and these rows are handed straight to an
 * AssemblySelector, whose options are the session's own `assemblyNames` and
 * which blanks a value that is not one of them — so a Quick start on an
 * alias-named track handed Manual a row that rendered empty. They are also what
 * `doSubmit` opens the views on, so canonicalizing here is what makes the two
 * modes launch the same thing for the same track.
 */
export function syntenyTrackRows(
  track: AnyConfigurationModel,
  assemblyManager: AssemblyNameResolver,
) {
  return canonicalAssemblyNames(
    readConfObject(track, 'assemblyNames') as string[],
    assemblyManager,
  )
}

/**
 * Which assembly of a synteny track's rows goes on each dotplot axis.
 *
 * **This is the only place that mapping is written down. Call it; don't
 * re-derive it.** Two independent derivations is how it drifts, and it has been
 * written backwards repeatedly — including in the docs, which claimed the query
 * goes on the x-axis until 2026-07-17.
 *
 * The chain: a track's `assemblyNames` are `[query, target]` (the
 * comparative-adapters convention — see `ImportSyntenyOpenCustomTrack`), and the
 * dotplot's public `assembly1`/`assembly2` props are `(y, x)` (see the dotplot
 * import form's `TrackSelector`). So query lands on **y** and target on **x**.
 *
 * There is no deeper truth to recover here: a synteny track answers in either
 * direction, so this is a defensible default rather than a fact about the track.
 * That is why the import form offers Swap, which is the `swapped` argument here.
 *
 * Swap is applied to the axes rather than to the rows, and `rows` must be the
 * track's own order. Reversing the row list instead only agrees with this for a
 * pairwise track: reversing an all-vs-all track's `[a, b, c]` yields `[c, b, a]`,
 * whose first two are a *different pair*, so Swap silently re-picked which pair
 * the dotplot showed instead of transposing the one it was showing.
 */
export function dotplotAxesFromRows(rows: string[], swapped = false) {
  const [first, second] = rows
  return swapped ? { y: second, x: first } : { y: first, x: second }
}

/**
 * Session synteny tracks that Quick start can launch on their own, so its list
 * only holds one-click-launchable entries rather than surfacing an option that
 * errors on Launch. Two ways a track fails that:
 *
 * - it implies fewer than two rows, so it is a single-row view, which a
 *   synteny/dotplot view cannot open;
 * - one of its rows is an assembly the session has no configuration for. Quick
 *   start is the opening mode whenever any track qualifies, so such a track
 *   seeded the form with a row whose name is not among the assembly Select's
 *   options (it renders empty), and Launch built a row whose init fails with
 *   "Assembly X not found", which errors the whole view. `connectedEndpoints`
 *   screens the other way into a row on the same test, and says why it is
 *   `has`.
 *
 * Both tests are on `syntenyTrackRows`, not on raw `assemblyNames`, so what is
 * screened is what Quick start would actually open: an alias resolves to the
 * assembly it names, and the padding empty string a half-written config leaves
 * behind is not a row and so cannot be the second one that qualifies a track.
 */
export function quickStartSyntenyTracks(
  tracks: AnyConfigurationModel[],
  assemblyManager: SessionAssemblies,
) {
  return tracks.filter(track => {
    if (!isSyntenyTrack(track)) {
      return false
    }
    const rows = syntenyTrackRows(track, assemblyManager)
    return rows.length >= 2 && rows.every(name => assemblyManager.has(name))
  })
}
