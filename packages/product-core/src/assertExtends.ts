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

/**
 * Compile-time assertion that a type has not degraded to `any`. Pass it the
 * `IsAny` of the type you are pinning; a failure reads `Type 'true' does not
 * satisfy the constraint 'false'`.
 *
 * ```ts
 * export type _ViewIsTyped = AssertNotAny<IsAny<ViewModel['session']['view']>>
 * ```
 *
 * This is the one check the others cannot make for you. `any` satisfies every
 * `AssertExtends`, implements every `SessionWith*` contract, and passes tsc,
 * jest and lint — so a surface that silently becomes `any` switches off type
 * checking everywhere downstream while every gate stays green.
 *
 * Composed MST models are where it happens here. `types.compose`'s overloads
 * are declared over `IModelType<P, O, FC, FS>`, so a model passed in as a naked
 * type parameter has nothing to infer those four from and the composed result
 * degrades.
 *
 * It takes the computed boolean rather than the type itself because the
 * constraint has to be checked where it is concrete: written as
 * `AssertNotAny<T> = AssertExtends<IsAny<T>, false>` the unbound `IsAny<T>` is
 * `boolean` and the alias fails at its own declaration, and the self-referential
 * `T extends IsAny<T> extends true ? never : unknown` is a circular constraint.
 */
export type AssertNotAny<IsItAny extends false> = IsItAny
