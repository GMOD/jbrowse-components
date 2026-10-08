import { copyParent } from './sampleCopies.ts'

import type { Sample } from '../types.ts'

/**
 * The species a fetch ships under the display's focus, the worker's half of
 * the display's `sources`: the focus, or every species when it names none the
 * adapter lists, so a stale focus does not leave the drawn rows empty. A copy
 * row (`hg38~2`) names a listed species when its sample is one, since the
 * adapter lists samples and not their copies. Undefined is every species. A
 * track that discovers its species from the blocks lists none before it reads,
 * so its focus applies as given, and the display draws only the rows it names.
 */
export function visibleSamples(
  focus: readonly string[] | undefined,
  listed: readonly Sample[],
) {
  if (!focus?.length) {
    return undefined
  }
  const ids = new Set(listed.map(s => s.id))
  return !ids.size ||
    focus.some(name => ids.has(name) || ids.has(copyParent(name) ?? ''))
    ? new Set(focus)
    : undefined
}
