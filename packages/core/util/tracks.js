import { getParent, isRoot } from 'mobx-state-tree'

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

/**
 * given an MST node, get the renderprops of the first parent container that has
 * renderProps
 * @param {TreeNode} node
 * @returns {object} renderprops, or empty object if none found
 */
export function getParentRenderProps(node) {
  for (
    let currentNode = getParent(node);
    !isRoot(currentNode);
    currentNode = getParent(currentNode)
  ) {
    if (currentNode.renderProps) return currentNode.renderProps
  }

  return {}
}

export function foo() {}
