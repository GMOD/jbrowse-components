import { resolveFollowSpan } from './resolveFollowSpan.ts'

import type { FollowStep } from './planFollowStep.ts'
import type { FollowAnswer } from './resolveFollowSpan.ts'

export type FollowAnswerCache = (step: FollowStep) => Promise<FollowAnswer>

// undefined for the envelope, which is a union of every loaded block and so can
// resolve differently for the same window once more of them arrive
function stepKey(step: FollowStep) {
  const { display, feat, toMate, window, windowInsideFeat } = step
  const { refName, start, end } = window
  return windowInsideFeat
    ? `${display.id} ${feat.id} ${toMate} ${refName}:${start}-${end}`
    : undefined
}

/**
 * One level's in-flight answer, shared by the question that asked for it.
 *
 * A settle wakes the exact pass three times with the same question, since
 * applying an answer flushes the moved row's coarse blocks and refetches it.
 * Holding the PROMISE rather than the span is what lets those wakes ride one
 * `SyntenyResolveMatchingRegion`; each still runs its own `alreadyShowing`
 * against its own window. The integration suite asserts that count.
 *
 * A rejection drops the entry, so the next pass asks again rather than
 * replaying one failure forever — and only if it is still the entry, since a
 * slow failure arriving after the window moved on would otherwise evict the
 * answer to a question that has not been asked yet.
 */
export function createFollowAnswerCache(): FollowAnswerCache {
  let entry: { key: string; pending: Promise<FollowAnswer> } | undefined
  return step => {
    const key = stepKey(step)
    if (key !== undefined && key === entry?.key) {
      return entry.pending
    }
    const pending = resolveFollowSpan(step)
    if (key !== undefined) {
      const own = { key, pending }
      entry = own
      pending.catch(() => {
        if (entry === own) {
          entry = undefined
        }
      })
    }
    return pending
  }
}
