import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The RPC cache key both display families key their refetch on: the display's
 * `rpcProps()` payload serialized to a string.
 *
 * A primitive, so an observer of it (a MobX computed or getter) re-fires only
 * when the payload actually changed — building the payload touches far more
 * observables than it returns (canvas builds it from a whole config snapshot via
 * `resolvePromotableConfigSnapshot`, which reads every slot on the display
 * config; HiC's `activeNormalization` reads the fetched
 * `availableNormalizations`), so an observer of the raw call refetches on purely
 * main-thread settings the payload deliberately excludes, and on fetched data it
 * only consulted. A fresh object would also never compare equal.
 *
 * `''` for a display with no `rpcProps` — the per-region family skips installing
 * `SettingsInvalidate` there entirely, and the global helper's trigger read
 * becomes a constant.
 *
 * The inverse hazard, since `JSON.stringify` is the comparison: a field that
 * doesn't survive serialization is a silently dead cache axis — changing it
 * refetches nothing, with no error to notice. A class instance needs a `toJSON`
 * (`SerializableFilterChain` has one, which is what makes the variant displays'
 * `filters` field a real key); an `undefined` value drops out of the string
 * entirely, so a slot toggling between `undefined` and a value that stringifies
 * the same way cannot invalidate. Prefer primitives and plain arrays.
 *
 * `rpcProps` is looked up dynamically rather than declared on either mixin's
 * public interface, so subclasses keep their narrow return types through MST's
 * `.views()` chains.
 */
export function serializeRpcProps(
  self: IAnyStateTreeNode & { rpcProps?: () => unknown },
) {
  const { rpcProps } = self
  return rpcProps ? JSON.stringify(rpcProps.call(self)) : ''
}
