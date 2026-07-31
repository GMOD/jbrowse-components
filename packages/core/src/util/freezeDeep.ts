// local rather than the `isObject` in `util/index.ts`, which re-exports this
// file — importing it back would be a module cycle for one predicate
function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Freeze `value` and everything reachable from it, in place, and return it.
 *
 * For a value handed to consumers **by reference on purpose**: a config slot's
 * `promotedBase` (the one literal every track sitting at base resolves to) and a
 * stored user preference (a promoted display-type default, read by every
 * following display). Sharing the reference is load-bearing in both cases —
 * `===` stability is what lets a display's cached MobX computed re-resolve
 * without waking anything downstream — so handing out a defensive copy per read
 * would trade a silent hazard for a real re-render on every read. Freezing keeps
 * the identity and makes "nothing mutates this" throw rather than quietly
 * rewriting a value every other track is reading.
 *
 * Both callers freeze once, at schema build or at the store write, over a value
 * that has to survive `postMessage` anyway — so the recursion is over small JSON
 * and costs nothing per read. Cyclic input terminates: each object is frozen
 * before its children are visited.
 */
export function freezeDeep<T>(value: T): T {
  if (isObjectLike(value) && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values<unknown>(value)) {
      freezeDeep(child)
    }
  }
  return value
}
