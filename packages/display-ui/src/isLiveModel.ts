import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * #api
 * Whether a display model can still be called into.
 *
 * The chrome's overlay slots guard every button with it: the terminal states
 * unmount the canvas, so a click landing after the track was closed would
 * otherwise run an action on a destroyed node.
 *
 * **`isAlive` alone throws on a plain object.** A host writing a custom display
 * over `DisplayChromeBase` may hand the chrome a plain object, and `isAlive`
 * runs `assertIsStateTreeNode`, which throws inside the click handler, where
 * React logs the error and continues: a Force load button that looks live and
 * does nothing. A plain object is never destroyed, so it is
 * always callable.
 */
export function isLiveModel(model: unknown) {
  return !isStateTreeNode(model) || isAlive(model)
}
