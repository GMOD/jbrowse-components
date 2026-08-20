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
 * Which row pair each of the form's NEW pairs came from, as a sparse list of old
 * pair indices. The single answer to "what moved where" when the assembly rows
 * change — selections read off it, and so does the radio choice each pair is
 * showing, so the two cannot disagree about which band the user configured.
 *
 * The form indexes both by row-pair *position*, but what they are about is a
 * *pair of assemblies*. Any edit to the rows — remove one, reorder them, retype
 * one in a Select — moves positions out from under them, and the two answers
 * stop agreeing. Symptoms differ by type and all of them were live at once: a
 * `preConfigured` pick quietly re-resolved (harmless), an explicit `none` slid
 * onto a pair the user never silenced, and a finished `userOpened` upload
 * stranded on assemblies it was not built for, where it reads as an *unfinished*
 * upload and disables Launch for something that cannot be finished.
 *
 * So every row edit goes through here: match old pairs to new ones by assembly
 * set (order-insensitively — a synteny track answers in either direction). A
 * pair that no longer exists takes what it held with it, which is the only loss
 * and the correct one.
 *
 * Empty slots mean "came from nowhere", which is what makes a new pair auto-pick
 * a pre-configured track, so the result is deliberately sparse rather than
 * padded with `none` — a deliberate no-track, which would suppress the form's
 * warning.
 */
function remapPairIndices(
  selections: (ImportFormSyntenyTrack | undefined)[],
  fromAssemblyNames: string[],
  toAssemblyNames: string[],
) {
  // EVERY source pair, including the ones holding nothing. They are what keeps
  // identical pairs lined up: a self-alignment stack (one assembly carrying both
  // haplotypes, three rows of it) has the same assembly set on every band, so
  // with only the configured pairs in the pool the lower band's selection was
  // the first thing the upper band matched, and Reverse rows or Auto-arrange
  // moved it up a band. An empty entry can only ever claim a target of the same
  // assemblies, which is the target that was going to be empty anyway.
  const unclaimed = syntenyPairs(fromAssemblyNames).map((pair, idx) => ({
    pair: selections[idx] ? selectionPair(selections[idx], pair) : pair,
    idx,
  }))
  return syntenyPairs(toAssemblyNames).map(pair => {
    const at = unclaimed.findIndex(entry => sameAssemblySet(entry.pair, pair))
    // claimed by the first pair it fits, so two pairs over the same assemblies
    // take two different entries rather than both taking the first
    return at === -1 ? undefined : unclaimed.splice(at, 1)[0]!.idx
  })
}

/**
 * Where each import-form selection belongs after the assembly rows change, as a
 * pair-indexed sparse list. {@link remapPairIndices} decides what moves where;
 * this reads the selections off it.
 */
export function remapSelectionsToPairs(
  selections: (ImportFormSyntenyTrack | undefined)[],
  fromAssemblyNames: string[],
  toAssemblyNames: string[],
) {
  return remapPairIndices(selections, fromAssemblyNames, toAssemblyNames).map(
    idx => (idx === undefined ? undefined : selections[idx]),
  )
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
 *
 * Returns the permutation it applied, for the form's own per-pair state to
 * follow — see `useImportFormSyntenyChoices`.
 */
export function remapImportFormSelections(
  model: ImportFormSyntenyModel,
  fromAssemblyNames: string[],
  toAssemblyNames: string[],
) {
  const selections = [...model.importFormSyntenyTrackSelections]
  const moved = remapPairIndices(selections, fromAssemblyNames, toAssemblyNames)
  model.clearImportFormSyntenyTracks()
  for (const [pairIdx, from] of moved.entries()) {
    const selection = from === undefined ? undefined : selections[from]
    if (selection) {
      model.setImportFormSyntenyTrack(pairIdx, selection)
    }
  }
  return moved
}
