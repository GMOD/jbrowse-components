/**
 * Compile-time assertion that `Actual` is assignable to `Expected`, evaluating
 * to `Actual`. There is no runtime component — referencing the alias forces the
 * check, and a mismatch surfaces as a type error at the reference site.
 *
 * The main use is binding a hand-written "shadow" contract to the real type it
 * shadows so the two can't silently drift. MST's `getParent<T>(self)` is an
 * unchecked assertion (`T` has no structural link to the actual parent), so a
 * child model that reaches into its parent via a local shape can keep compiling
 * after the real parent renames or drops a member — until it throws at runtime.
 * Pinning `AssertExtends<RealRootModel, ShadowParent>` turns that into a build
 * error:
 *
 * ```ts
 * interface SessionModelParent {
 *   version: string
 *   assemblyManager: AssemblyManager
 * }
 * // real root must satisfy the shadow the session reaches for
 * export type _Check = AssertExtends<ViewModel, SessionModelParent>
 * ```
 */
export type AssertExtends<Actual extends Expected, Expected> = Actual
