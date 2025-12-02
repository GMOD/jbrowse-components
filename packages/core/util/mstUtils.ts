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
} from './types'

import type PluginManager from '../PluginManager'
import type { TypeTestedByPredicate } from './types'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * find the first node in the hierarchy that matches the given predicate
 */
export function findParentThat(
  node: IAnyStateTreeNode,
  predicate: (thing: IAnyStateTreeNode) => boolean,
) {
  if (!hasParent(node)) {
    throw new Error('node does not have parent')
  }
  let currentNode = getParent<IAnyStateTreeNode>(node)

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (currentNode && isAlive(currentNode)) {
    if (predicate(currentNode)) {
      return currentNode
    }
    if (hasParent(currentNode)) {
      currentNode = getParent<any>(currentNode)
    } else {
      break
    }
  }
  throw new Error('no matching node found')
}

/**
 * find the first node in the hierarchy that matches the given 'is' typescript
 * type guard predicate
 */
export function findParentThatIs<T extends (a: IAnyStateTreeNode) => boolean>(
  node: IAnyStateTreeNode,
  predicate: T,
) {
  return findParentThat(node, predicate) as TypeTestedByPredicate<T>
}

/**
 * get the current JBrowse session model, starting at any node in the state
 * tree
 */
export function getSession(node: IAnyStateTreeNode) {
  try {
    return findParentThatIs(node, isSessionModel)
  } catch (e) {
    throw new Error('no session model found!')
  }
}

/**
 * get the state model of the view in the state tree that contains the given
 * node
 */
export function getContainingView(node: IAnyStateTreeNode) {
  try {
    return findParentThatIs(node, isViewModel)
  } catch (e) {
    throw new Error('no containing view found')
  }
}

/**
 * get the state model of the view in the state tree that contains the given
 * node
 */
export function getContainingTrack(node: IAnyStateTreeNode) {
  try {
    return findParentThatIs(node, isTrackModel)
  } catch (e) {
    throw new Error('no containing track found')
  }
}

/**
 * get the state model of the display in the state tree that contains the given
 * node
 */
export function getContainingDisplay(node: IAnyStateTreeNode) {
  try {
    return findParentThatIs(node, isDisplayModel)
  } catch (e) {
    throw new Error('no containing display found')
  }
}

export function getEnv(obj: any) {
  return getEnvMST<{ pluginManager: PluginManager }>(obj)
}
