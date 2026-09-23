import type { Sample } from '../types.ts'

/**
 * The species a fetch ships under the display's focus: the focus, or every
 * species when it names none the adapter lists, the worker's half of
 * `keptRows`, so a stale focus does not leave the rows the display draws
 * empty. Undefined is every species. A track that discovers its species from
 * the blocks lists none before it reads, so its focus applies as given.
 */
export function visibleSamples(
  focus: readonly string[] | undefined,
  listed: readonly Sample[],
) {
  const kept = focus?.length ? new Set(focus) : undefined
  return kept && listed.length && !listed.some(s => kept.has(s.id))
    ? undefined
    : kept
}
