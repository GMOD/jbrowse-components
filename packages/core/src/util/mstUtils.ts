import {
  getEnv as getEnvMST,
  getParent,
  hasParent,
  isAlive,
} from '@jbrowse/mobx-state-tree'

import {
  isDisplayModel,
  isSessionModel,
  isTrackModel,
  isViewModel,
} from './types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type {
  AbstractDisplayModel,
  AbstractSessionModel,
  AbstractTrackModel,
  AbstractViewModel,
  TypeTestedByPredicate,
} from './types/index.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

const containingDisplayCache = new WeakMap<
  IAnyStateTreeNode,
  AbstractDisplayModel
>()
const containingTrackCache = new WeakMap<
  IAnyStateTreeNode,
  AbstractTrackModel
>()
const containingViewCache = new WeakMap<IAnyStateTreeNode, AbstractViewModel>()
const sessionCache = new WeakMap<IAnyStateTreeNode, AbstractSessionModel>()

export function findParentThat(
  node: IAnyStateTreeNode,
  predicate: (thing: IAnyStateTreeNode) => boolean,
) {
  if (!hasParent(node)) {
    const alive = isAlive(node)
    const nodeType = (node as { type?: unknown }).type
    console.warn(
      `[findParentThat] node has no parent: alive=${alive} type=${nodeType}`,
    )
    throw new Error('node does not have parent')
  }
  let currentNode = getParent(node)

  while (isAlive(currentNode)) {
    if (predicate(currentNode)) {
      return currentNode
    }
    if (hasParent(currentNode)) {
      currentNode = getParent<IAnyStateTreeNode>(currentNode)
    } else {
      break
    }
  }
  throw new Error('no matching node found')
}

export function findParentThatIs<T extends (a: IAnyStateTreeNode) => boolean>(
  node: IAnyStateTreeNode,
  predicate: T,
) {
  return findParentThat(node, predicate) as TypeTestedByPredicate<T>
}

function cachedParent<T extends IAnyStateTreeNode>(
  cache: WeakMap<IAnyStateTreeNode, T>,
  node: IAnyStateTreeNode,
  finder: () => T,
  errorMsg: string,
): T {
  const cached = cache.get(node)
  if (cached && isAlive(cached)) {
    return cached
  }
  try {
    const result = finder()
    cache.set(node, result)
    return result
  } catch (e) {
    throw new Error(errorMsg, { cause: e })
  }
}

/**
 * #api core/util
 * Returns the JBrowse session model for any node in the state tree. Throws if
 * the node has no session ancestor.
 */
export function getSession(node: IAnyStateTreeNode): AbstractSessionModel {
  return cachedParent(
    sessionCache,
    node,
    () => findParentThatIs(node, isSessionModel),
    'no session model found!',
  )
}

/**
 * #api core/util
 * Returns the view model that contains the given node. Throws if the node has no
 * containing view.
 */
export function getContainingView(node: IAnyStateTreeNode): AbstractViewModel {
  return cachedParent(
    containingViewCache,
    node,
    () => findParentThatIs(node, isViewModel),
    'no containing view found',
  )
}

/**
 * #api core/util
 * Returns the track model that contains the given node. Throws if the node has
 * no containing track.
 */
export function getContainingTrack(
  node: IAnyStateTreeNode,
): AbstractTrackModel {
  return cachedParent(
    containingTrackCache,
    node,
    () => findParentThatIs(node, isTrackModel),
    'no containing track found',
  )
}

/**
 * #api core/util
 * Returns the display model that contains the given node. Throws if the node has
 * no containing display.
 */
export function getContainingDisplay(
  node: IAnyStateTreeNode,
): AbstractDisplayModel {
  return cachedParent(
    containingDisplayCache,
    node,
    () => findParentThatIs(node, isDisplayModel),
    'no containing display found',
  )
}

/**
 * #api core/util
 * Returns the MST environment for a node, which carries the `pluginManager`.
 */
export function getEnv(obj: IAnyStateTreeNode) {
  return getEnvMST<{ pluginManager: PluginManager }>(obj)
}

export function hashCode(str: string) {
  let hash = 0
  if (str.length === 0) {
    return hash
  }
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = (hash << 5) - hash + chr
    hash |= 0
  }
  return hash
}

export function objectHash(obj: object) {
  return `${hashCode(JSON.stringify(obj))}`
}
