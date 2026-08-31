import { observable } from 'mobx'

import { reportContractViolation } from './contractReports.ts'

import type { ObservableMap } from 'mobx'

// Maps built here check themselves at the `set`, so the upload seam skips them
// and a bad entry is reported once, with the field named.
//
// Module state, and duplication-safe in the only way that matters here: two
// live copies of this package would each hold their own set, so a map built by
// one and installed through the other is checked twice rather than missed.
const checkedAtTheStore = new WeakSet<ReadonlyMap<number, unknown>>()

export function isCheckedAtTheStore(map: ReadonlyMap<unknown, unknown>) {
  return checkedAtTheStore.has(map as ReadonlyMap<number, unknown>)
}

/**
 * The volatile a display keys its per-region payloads by
 * (`displayedRegionIndex` → result). Every one of them in tree is built with
 * this, so "how is per-region data represented" has one answer — see
 * ADR-060.
 *
 * **Shallow, and that follows from an invariant the codebase already states**:
 * per-region values are freshly constructed and never mutated (agent-docs
 * CLAUDE.md; backends diff by reference identity). Nothing inside an entry can
 * therefore change, so the deep enhancer's field-level atoms can never fire —
 * they are unreachable reactivity, not a safety margin. What they do cost is
 * paid on every insert and every read:
 *
 * - **Insert.** `deepEnhancer` recursively rebuilds each payload as an
 *   observable object graph — the stored value is not the object the worker
 *   produced. A multi-wiggle region is one atom per field per source, so a
 *   thousand-sample track pays ~18k on every pan; MAF pays the whole set again
 *   for every cached region on every row reorder, since `placeFetchedRows`
 *   re-places them all.
 * - **Read.** Each field access goes through `getObservablePropValue_`. Hot
 *   loops that hoist their typed arrays are fine, but the ones that don't were
 *   paying it per iteration.
 *
 * Typed arrays and class instances (Flatbush) pass through the deep enhancer
 * untouched, so the arrays were never the cost — the objects holding them were.
 *
 * Coarser tracking is the only behavioral difference, and it is unobservable
 * here: an entry is only ever replaced whole, so the keys atom and the entry's
 * own atom fire on exactly the same `.set`/`.delete`/`.clear`.
 *
 * Not for maps of primitives (`groupMaxHeightOverrides`,
 * `detectedModifications`), where the enhancer is a no-op, nor for UI state
 * whose values are mutated in place.
 *
 * **Dev-only, every entry is checked on the way in.** A fetch RPC answers a
 * payload or a `regionTooLarge` refusal, and every reader of this map is
 * written for the payload — so a value that is not one is a fetch that did not
 * happen, stored as though it had. There is no type to catch it: `onResult`
 * receives whatever the RPC resolved, typed as the payload it was supposed to
 * be, and the mock in the display harness resolved `undefined` for every
 * un-stubbed method for as long as the harness existed. Six reactions across
 * four packages then threw `Cannot read properties of undefined` on every run,
 * inside autoruns MobX catches and logs — invisible until the reaction gate
 * went in.
 *
 * Checked HERE because this is the one constructor all of them share, so the
 * store is one place while the readers are hundreds, and because a payload
 * caught at the `set` names the region and the display instead of surfacing as
 * a TypeError in whichever getter happened to read it first.
 *
 * **`T extends object` is the same statement as the check, in the one place a
 * type can make it.** The runtime predicate is "a non-null object", and
 * `object` is that predicate spelled as a constraint — so a map cannot be
 * *declared* as holding something the check would then report, which is the
 * only way the two could come apart. It costs nothing: every payload in tree is
 * an interface, an array, an intersection or a class.
 */
export function regionDataMap<T extends object>(
  // the field this map is stored on, so a violation names the map rather than
  // the thirteen that share this constructor. No default — an omitted name is
  // the anonymous message this parameter exists to remove, and it would be
  // reached by forgetting rather than by deciding.
  name: string,
): ObservableMap<number, T> {
  const map = observable.map<number, T>(undefined, { deep: false, name })
  checkedAtTheStore.add(map)
  const set = map.set.bind(map)
  // one `typeof` per stored region, which is why it is not gated on the channel
  // being armed: a violation found in a production build is buffered until
  // something arms it, where a gate here would have thrown the evidence away
  map.set = (key: number, value: T) => {
    // as `unknown`, because the claim that this is a `T` is the thing in
    // doubt — checking it against its own declared type narrows to `never`
    // and checks nothing
    const stored: unknown = value
    if (typeof stored !== 'object' || stored === null) {
      // reported and never thrown: the store runs inside the fetch's own result
      // handler, where a throw is caught and reported as a failed region —
      // which would hide the violation being reported.
      reportContractViolation(
        'display',
        `${name}: region ${key} stored ` +
          `\`${stored === null ? 'null' : typeof stored}\`, not a ` +
          'payload. A fetch RPC answers a payload or a regionTooLarge ' +
          'refusal; storing anything else leaves every reader of this map ' +
          'reading through it.',
      )
    }
    return set(key, value)
  }
  return map
}
