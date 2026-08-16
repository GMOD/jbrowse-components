import { sameAssemblySet } from './getSyntenyTracks.ts'
import { syntenyPairs } from './syntenyPairs.ts'

import type {
  ImportFormSyntenyModel,
  ImportFormSyntenyTrack,
} from './SelectorTypes.ts'

/**
 * Which two assemblies a selection is about. Normally the pair it was sitting
 * on, but a finished upload bakes in the assemblies it was built against, and
 * those outrank the position: an upload can already be sitting on the wrong pair
 * when the remap starts, which is exactly the state this exists to get out of.
 */
function selectionPair(selection: ImportFormSyntenyTrack, pair: string[]) {
  return selection.type === 'userOpened' && selection.value
    ? selection.value.assemblyNames
    : pair
}

/**
 * Where each import-form selection belongs after the assembly rows change, as a
 * pair-indexed sparse list.
 *
 * The form indexes its selections by row-pair *position*, but what a selection
 * is about is a *pair of assemblies*. Any edit to the rows — remove one, reorder
 * them, retype one in a Select — moves positions out from under the selections,
 * and the two answers stop agreeing. Symptoms differ by type and all of them
 * were live at once: a `preConfigured` pick quietly re-resolved (harmless), an
 * explicit `none` slid onto a pair the user never silenced, and a finished
 * `userOpened` upload stranded on assemblies it was not built for, where it
 * reads as an *unfinished* upload and disables Launch for something that cannot
 * be finished.
 *
 * So every row edit goes through here: match old pairs to new ones by assembly
 * set (order-insensitively — a synteny track answers in either direction) and
 * carry the whole selection along. A pair that no longer exists takes its
 * selection with it, which is the only loss and the correct one.
 *
 * Empty slots mean "no selection", which is what makes a new pair auto-pick a
 * pre-configured track, so the result is deliberately sparse rather than padded
 * with `none` — a deliberate no-track, which would suppress the form's warning.
 */
export function remapSelectionsToPairs(
  selections: (ImportFormSyntenyTrack | undefined)[],
  fromAssemblyNames: string[],
  toAssemblyNames: string[],
) {
  const unclaimed = syntenyPairs(fromAssemblyNames).flatMap((pair, idx) => {
    const selection = selections[idx]
    return selection
      ? [{ pair: selectionPair(selection, pair), selection }]
      : []
  })
  const remapped: (ImportFormSyntenyTrack | undefined)[] = []
  for (const pair of syntenyPairs(toAssemblyNames)) {
    const idx = unclaimed.findIndex(entry => sameAssemblySet(entry.pair, pair))
    // a selection is claimed by the first pair it fits, so two pairs over the
    // same assemblies take two different selections rather than both taking the
    // first
    remapped.push(
      idx === -1 ? undefined : unclaimed.splice(idx, 1)[0]!.selection,
    )
  }
  return remapped
}

/**
 * Move a form's selections onto the assembly rows it is about to have, in the
 * model. **Every edit to the rows goes through here** — add, remove, reorder or
 * retype a row in the synteny form, change either axis in the dotplot form —
 * because a selection is indexed by pair position but is about a pair of
 * assemblies, and an edit moves the positions out from under it. See
 * `remapSelectionsToPairs` for what each type does when its pair goes away.
 *
 * Shared rather than written per form: the dotplot's one pair looks too small to
 * need it, and going without meant a finished upload stranded on the old axes,
 * reading back as an *unfinished* one and disabling Launch for something that
 * could not be finished — the exact failure the synteny form had already fixed.
 */
export function remapImportFormSelections(
  model: ImportFormSyntenyModel,
  fromAssemblyNames: string[],
  toAssemblyNames: string[],
) {
  const remapped = remapSelectionsToPairs(
    model.importFormSyntenyTrackSelections,
    fromAssemblyNames,
    toAssemblyNames,
  )
  model.clearImportFormSyntenyTracks()
  for (const [pairIdx, selection] of remapped.entries()) {
    if (selection) {
      model.setImportFormSyntenyTrack(pairIdx, selection)
    }
  }
}
