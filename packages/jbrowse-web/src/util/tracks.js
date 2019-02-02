import { getParent } from 'mobx-state-tree'

/* utility functions for use by track models and so forth */

/**
 * get the closest view object that contains this state tree node
 * @param {MSTNode} node
 */
export function getContainingView(node) {
  let currentNode = node
  while (currentNode.bpPerPx === undefined) currentNode = getParent(currentNode)
  return currentNode
}

export function foo() {}
