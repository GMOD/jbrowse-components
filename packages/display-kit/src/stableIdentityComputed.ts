import { compareStructural, computed } from 'mobx'

/**
 * A computed whose value IDENTITY survives a recomputation that lands on a
 * structurally equal value.
 *
 * For a derivation whose consumers cache on `!==` rather than on content. A row
 * list rebuilt from `rpcDataMap` is the case both multi-row families hit: a
 * plain getter hands out a fresh array on every region arrival, that array
 * reaches `gpuProps()` / `featurePaintInputs`, and its identity clears
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
