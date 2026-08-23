import {
  getEnv as getEnvMST,
  getParent,
  hasParent,
  isAlive,
  isRoot,
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
import type {
  IAnyStateTreeNode,
  IStateTreeNode,
} from '@jbrowse/mobx-state-tree'

// Memoized ancestor lookups, and load-bearing ones: `getSession` alone has 465
// call sites and is reached from render paths, while the walk it replaces is
// six `getParent` hops — every MST array between a display and the session is a
// node of its own. Worth 13.6-17.6x, and 3.2-3.7x even inside a reaction
// (`packages/core/benches/parentWalkMemo.bench.ts`, which also rules out the
// obvious alternative: the predicate's `in` checks are ~1% of the walk, so
// making it cheaper buys nothing).
//
// Keying on the node is safe because nothing re-parents one — both `detach`
// call sites hand the node straight to `scheduleDetachedDestroy` (ADR-069), so
// a cached ancestor can only go stale by dying, which `cachedParent`'s
// `isAlive` catches. That is the difference from the three memos REJECTED_IDEAS
// records removing: each keyed on something its caller had just allocated.
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
 * Resolve user-authored refName text against the assembly of the view
 * containing `node` — the one normalization layer, which resolves aliases and
 * casing together. Falls back to the input when the assembly is absent or its
 * aliases have not loaded.
 *
 * Keyed off the VIEW's assembly rather than the track's, because the view is
 * what the comparison is against: displayed regions, loaded regions and blocks
 * all carry the refNames the view laid out.
 *
 * Reach for this wherever a refName a *person* wrote is about to be compared
 * against regions, features or blocks, which carry the assembly's canonical
 * name. A refName a display copied off a region is canonical already and needs
 * nothing; one that arrived in a session spec, a config slot or a URL is
 * whatever the author read out of the location box.
 *
 * Skipping it fails silently and, worse, assembly-dependently: `chr12` matches
 * on an assembly canonicalized `chr12` and matches nothing on one canonicalized
 * `12`, so the same spec key works on one config and quietly does nothing on
 * the next, with no error for anyone to act on.
 *
 * Resolves through `getCanonicalRefName2`, whose fallback is what keeps a spec
 * read before the alias file has loaded from throwing — and the getters that
 * read user specs do run from the first render.
 *
 * Takes a refName, not a spec that might hold one: the resolver reads
 * `refName.toLowerCase()`, so anything else throws once the aliases are there,
 * and a caller reading an untyped `frozen` slot has to establish that it names
 * a refName at all before this is the right question to ask of it.
 */
export function canonicalizeViewRefName(
  node: IAnyStateTreeNode,
  refName: string,
): string {
  const { assemblyManager } = getSession(node)
  const name = getContainingView(node).assemblyNames?.[0]
  const assembly = name ? assemblyManager.get(name) : undefined
  return assembly?.getCanonicalRefName2(refName) ?? refName
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
