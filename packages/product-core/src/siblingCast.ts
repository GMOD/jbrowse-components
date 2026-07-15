import type { BaseRootModel } from './RootModel/BaseRootModel.ts'
import type { BaseSession } from './Session/BaseSession.ts'

/**
 * `types.compose` can't thread the types of sibling mixins into one another, so
 * a mixin that reaches members contributed by a co-composed base (`jbrowse`,
 * `adminMode`, `session`, ...) must assert that base onto its own partial
 * `self`. These helpers name that assertion in one place — instead of the
 * ad-hoc inline `s as typeof s & BaseSession` scattered across mixins — so the
 * assert target is fixed (can't drift to the wrong type) and the seam is
 * greppable. The cast is unavoidable: it encodes the compose-time invariant
 * that these mixins are only ever composed onto the named base.
 */
export function asSession<S>(self: S): S & BaseSession {
  return self as S & BaseSession
}

export function asRoot<S>(self: S): S & BaseRootModel {
  return self as S & BaseRootModel
}
