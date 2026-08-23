import { getParent, hasParent, isAlive, isRoot } from '@jbrowse/mobx-state-tree'

import type { TypeTestedByPredicate } from './types/predicate.ts'
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
} from '@jbrowse/mobx-state-tree'

// The ancestor walk itself, with no application in its type graph.
// `mstUtils.ts` is where the walks that return an `AbstractSessionModel` live
// and is therefore as expensive to import as the session interface;
// `sessionServices.ts` gets the same primitives without paying for that.

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

/**
 * Memoized ancestor lookups, and load-bearing ones: `getSession` alone has 465
 * call sites and is reached from render paths, while the walk it replaces is
 * six `getParent` hops — every MST array between a display and the session is a
 * node of its own. Worth 13.6-17.6x, and 3.2-3.7x even inside a reaction
 * (`packages/core/benches/parentWalkMemo.bench.ts`, which also rules out the
 * obvious alternative: the predicate's `in` checks are ~1% of the walk, so
 * making it cheaper buys nothing).
 *
 * Keying on the node is safe because nothing re-parents one — both `detach`
 * call sites hand the node straight to `scheduleDetachedDestroy` (ADR-069), so
 * a cached ancestor can only go stale by dying, which the `isAlive` check
 * catches. That is the difference from the three memos REJECTED_IDEAS records
 * removing: each keyed on something its caller had just allocated.
 */
export function cachedParent<T>(
  cache: WeakMap<IAnyStateTreeNode, T>,
  node: IAnyStateTreeNode,
  finder: () => T,
  errorMsg: string,
) {
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
 * The `rpcSessionId` of the highest node at or above `thisNode` that declares
 * one — which webworker its work is routed to.
 *
 * The walk includes the root. It used to stop *before* it (`!isRoot(node)` as
 * the loop condition), which silently made a tree whose only rpcSessionId-
 * bearing node was the root throw "no parent node in the state tree has an
 * `rpcSessionId`". Nothing in the app hit that — the id lives on a track, deep
 * in the tree — but a test building a minimal session had to wrap it in a
 * throwaway root purely to dodge this.
 */
export function getRpcSessionId(thisNode: IAnyStateTreeNode) {
  interface NodeWithRpcSessionId extends IStateTreeNode {
    rpcSessionId: string
  }
  let highestRpcSessionId: string | undefined

  for (let node = thisNode; ; node = getParent<IAnyStateTreeNode>(node)) {
    if ('rpcSessionId' in node) {
      highestRpcSessionId = (node as NodeWithRpcSessionId).rpcSessionId
    }
    if (isRoot(node)) {
      break
    }
  }
  if (!highestRpcSessionId) {
    throw new Error(
      'getRpcSessionId failed, no parent node in the state tree has an `rpcSessionId` attribute',
    )
  }
  return highestRpcSessionId
}
