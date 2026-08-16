/**
 * True only for `any`. `1 & T` collapses to `any` when T is `any`, and
 * `0 extends any` holds; for any concrete T it is `0 extends 1 & T` → false.
 *
 * Useful because `any` is the one type that passes every other check. A model
 * surface that degrades to it — a generic MST type parameter that failed to
 * infer, a plugin-supplied `IAnyType` — keeps tsc, jest and lint green while
 * silently switching off type checking at every call site downstream. Pair it
 * with product-core's `AssertNotAny` to turn that into a build error.
 */
export type IsAny<T> = 0 extends 1 & T ? true : false
