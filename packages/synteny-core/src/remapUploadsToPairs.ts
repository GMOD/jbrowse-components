import { sameAssemblySet } from './getSyntenyTracks.ts'
import { syntenyPairs } from './syntenyPairs.ts'

import type { ImportFormSyntenyTrack } from './SelectorTypes.ts'

/**
 * Where each finished upload belongs after the rows are reordered, as a
 * pair-indexed sparse list.
 *
 * Selections are indexed by row position, so reordering rows invalidates them
 * wholesale. That is harmless for a `preConfigured` pick, which is a preference
 * the new pair can re-derive, but an upload carries a file location and adapter
 * the user typed in, and dropping it is silent data loss. An upload also bakes in
 * the assemblies it was created against, which is exactly enough to find its pair
 * again wherever the reorder put it. An upload whose assemblies no longer form an
 * adjacent pair has nowhere to go and is left out.
 *
 * Empty slots mean "no selection", which is what makes the new pair auto-pick a
 * pre-configured track, so the result is deliberately sparse rather than padded
 * with `none` (a deliberate no-track, which would suppress the form's warning).
 */
export function remapUploadsToPairs(
  selections: (ImportFormSyntenyTrack | undefined)[],
  assemblyNames: string[],
) {
  const unplaced = selections.flatMap(selection =>
    selection?.type === 'userOpened' && selection.value
      ? [selection.value]
      : [],
  )
  const pairs = syntenyPairs(assemblyNames)
  const remapped: (ImportFormSyntenyTrack | undefined)[] = []
  for (const pair of pairs) {
    const idx = unplaced.findIndex(conf =>
      sameAssemblySet(conf.assemblyNames, pair),
    )
    // an upload is claimed by the first pair it fits, so two pairs over the same
    // assemblies take two different uploads rather than both taking the first
    remapped.push(
      idx === -1
        ? undefined
        : { type: 'userOpened', value: unplaced.splice(idx, 1)[0] },
    )
  }
  return remapped
}
