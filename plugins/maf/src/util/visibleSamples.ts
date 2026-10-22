import { copyParent } from './sampleCopies.ts'

/**
 * The rows a focus keeps, as `isRowVisible` reads them, for the worker's fetch
 * and the display's `clusterableSources` alike: the focus, or every row when it
 * names none of the `listed` species, so a stale focus does not leave the drawn
 * rows empty. A copy row (`hg38~2`) names a listed species when its sample is
 * one, since the adapter lists samples and not their copies. Undefined is every
 * row. A track that discovers its species from the blocks lists none, so its
 * focus applies as given, and the display draws only the rows it names.
 */
export function visibleSamples(
  focus: readonly string[] | undefined,
  listed: readonly { name: string }[],
) {
  if (!focus?.length) {
    return undefined
  }
  const names = new Set(listed.map(s => s.name))
  return !names.size ||
    focus.some(name => names.has(name) || names.has(copyParent(name) ?? ''))
    ? new Set(focus)
    : undefined
}
