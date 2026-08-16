import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * #api
 * Whether an overlay's model can still be called into.
 *
 * The terminal states unmount the canvas, so a click landing after the track was
 * closed would otherwise run an action on a destroyed node — which is why both
 * overlay sets guard their one button with `isAlive`.
 *
 * **`isAlive` alone is wrong here, and it throws rather than answering.** The
 * four model shapes in `chromeOverlays.ts` are structural on purpose ("A display
 * satisfies one by having the fields; no mixin has to be composed"), so a host
 * writing their own display over `DisplayChromeBase` may hand these components a
 * plain object. `isAlive` runs `assertIsStateTreeNode` and throws on one, inside
 * an event handler, where React logs it and moves on — leaving the Force load
 * button looking live and doing nothing, which is the exact state
 * `DisplayChromeOverlays.TooLarge` documents itself as existing to prevent.
 *
 * A plain object is never destroyed, so it is always callable. The liveness
 * question only exists for an MST node.
 */
export function isLiveModel(model: unknown) {
  return !isStateTreeNode(model) || isAlive(model)
}
