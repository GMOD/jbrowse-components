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
 */
export type AssertSessionModel<T extends AbstractSessionModel> = AssertExtends<
  T,
  AbstractSessionModel
>
