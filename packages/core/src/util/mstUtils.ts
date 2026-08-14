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
 * `initialized` gates the call rather than a try/catch, because
 * `getCanonicalRefName` THROWS before the alias file has loaded — and the
 * getters that read user specs run from the first render.
 *
 * Takes a refName, not a spec that might hold one: `getCanonicalRefName` reads
 * `refName.toLowerCase()` and throws on anything else, so a caller reading an
 * untyped `frozen` slot has to establish that it names a refName at all before
 * this is the right question to ask of it.
 */
export function canonicalizeViewRefName(
  node: IAnyStateTreeNode,
  refName: string,
): string {
  const { assemblyManager } = getSession(node)
  const name = getContainingView(node).assemblyNames?.[0]
  const assembly = name ? assemblyManager.get(name) : undefined
  return assembly?.initialized
    ? (assembly.getCanonicalRefName(refName) ?? refName)
    : refName
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
