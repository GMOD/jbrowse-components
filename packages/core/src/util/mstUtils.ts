import { getEnv as getEnvMST, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import { cachedParent, findParentThatIs } from './parentWalk.ts'
import {
  addOrReplaceView,
  isDisplayModel,
  isSessionModel,
  isTrackModel,
  isViewModel,
} from './types/index.ts'

import type PluginManager from '../PluginManager.ts'
import type {
  AbstractDisplayModel,
  AbstractSessionModel,
  AbstractViewContainer,
  AbstractTrackModel,
  AbstractViewModel,
} from './types/index.ts'
import type {
  AssemblyHost,
  RenderingServices,
} from './types/renderingServices.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export {
  findParentThat,
  findParentThatIs,
  getRpcSessionId,
} from './parentWalk.ts'

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
 * The host's assembly manager, for a module that resolves names and nothing
 * else.
 *
 * Unlike the accessors in `sessionServices.ts` this one buys the caller no
 * smaller type graph — an `AssemblyManager` is an MST model a `PluginManager`
 * built, so naming it costs what naming a session costs. It is here to say
 * which service is wanted, and because that cost is the finding: the assembly
 * manager is the one thing on `AbstractSessionModel` a third-party host cannot
 * simply implement.
 */
export function getAssemblyHost(node: IAnyStateTreeNode): AssemblyHost {
  return getSession(node)
}

/**
 * #api core/util
 * Everything a display needs of its host in order to draw a region: the
 * assemblies, the RPC entry point and the colors.
 */
export function getRenderingServices(
  node: IAnyStateTreeNode,
): RenderingServices {
  return getSession(node)
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

/**
 * #api core/util
 * `addOrReplaceView` for view types whose state model may be lazily loaded;
 * the synchronous `addOrReplaceView` requires it loaded already.
 */
export async function launchOrReplaceView(args: {
  session: AbstractViewContainer
  typeName: string
  initialState?: Record<string, unknown>
  replacing?: AbstractViewModel
}) {
  // a test's fake session is not an MST node; addView's own guard is the
  // error path there
  if (isStateTreeNode(args.session)) {
    const { pluginManager } = getEnvMST<{ pluginManager?: PluginManager }>(
      args.session,
    )
    await pluginManager?.getViewType(args.typeName).loadStateModel()
    // the displays of the tracks a launch opens with are dynamic imports too
    await pluginManager?.preloadSessionTypes({
      views: [{ type: args.typeName, ...args.initialState }],
    })
  }
  return addOrReplaceView(args)
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
