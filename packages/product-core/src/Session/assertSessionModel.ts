import type { AssertExtends } from '../assertExtends.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util/types'

/**
 * Compile-time assertion that a concrete session-model instance type satisfies
 * `AbstractSessionModel`. Reference it with a product's session instance type
 * to force the check; there is no runtime component, so a missing member
 * surfaces as a type error at the reference site:
 *
 * ```ts
 * type _Check = AssertSessionModel<Instance<WebSessionModelType>>
 * ```
 *
 * Every product's session model pairs this with one `AssertExtends` per
 * capability contract it relies on, because this assertion alone is not enough:
 * `AbstractSessionModel` marks those capabilities **optional**, so it cannot
 * catch a member drifting out of sync with the `SessionWith*` interface plugins
 * actually narrow to. Keep them as one assertion per contract rather than
 * collapsing them into a list — the whole value is the compile error naming the
 * contract that broke.
 */
export type AssertSessionModel<T extends AbstractSessionModel> = AssertExtends<
  T,
  AbstractSessionModel
>
