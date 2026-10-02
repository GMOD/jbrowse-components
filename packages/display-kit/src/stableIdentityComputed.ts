import { compareStructural, computed } from 'mobx'

/**
 * A computed whose value IDENTITY survives a recomputation that lands on a
 * structurally equal value.
 *
 * For a derivation whose consumers cache on `!==` rather than on content. A row
 * list rebuilt from `rpcDataMap` is the case both multi-row families hit: a
 * plain getter hands out a fresh array on every region arrival, that array
 * reaches `gpuProps()` / `encodeInputs`, and its identity clears
 * render-core `installUpload`'s encode cache — so region k's arrival re-encodes
 * regions 1..k-1 into the bytes they already held, and a progressive load pays
 * O(N^2) for rediscovering the same rows.
 *
 * Strip anything bulky (a feature array) off the value first: the comparer
 * walks whatever it is given.
 */
export function stableIdentityComputed<T>(compute: () => T) {
  return computed(compute, { equals: compareStructural })
}

/**
 * A keeper that hands back the value it last saw while each new one is
 * structurally equal to it, whether or not anything observes the read. For a
 * small value only: an unobserved computed hands out a fresh object per read,
 * and keeping identity there costs a walk per read, which a settings payload
 * must not pay on every pan (`perFrameStoreCost.test.ts`).
 */
export function sameAsLast<T>() {
  let last: { value: T } | undefined
  return (value: T) => {
    if (!last || !compareStructural(last.value, value)) {
      last = { value }
    }
    return last.value
  }
}
