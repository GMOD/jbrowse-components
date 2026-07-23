import {
  isSessionWithAddAssembly,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'

import type { DockviewLayoutNode } from '../DockviewLayout/index.ts'
import type { LayoutNode, ViewSpec } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'

// Convert LayoutNode (view indices into the spec's `views` array) to
// DockviewLayoutNode (view IDs). `viewIds` is indexed the same as that spec
// array — element i is the id of the view the i-th spec entry created, or
// undefined if it created none — so a layout index maps to the right view
// regardless of what order the views ended up in on the session.
function convertLayoutNode(
  node: LayoutNode,
  viewIds: (string | undefined)[],
): DockviewLayoutNode {
  if (node.views !== undefined) {
    // Panel node - convert view indices to view IDs
    const ids = node.views
      .map(idx => viewIds[idx])
      .filter((id): id is string => id !== undefined)
    return { viewIds: ids, size: node.size }
  }
  if (node.children) {
    // Container node - recursively convert children
    return {
      direction: node.direction,
      children: node.children.map(child => convertLayoutNode(child, viewIds)),
      size: node.size,
    }
  }
  return {}
}

// use extension point named e.g. LaunchView-LinearGenomeView to initialize an
// LGV session
export async function loadSessionSpec(
  {
    views,
    sessionAssemblies = [],
    sessionTracks = [],
    layout,
    sessionName,
  }: {
    views: ViewSpec[]
    sessionAssemblies?: Record<string, unknown>[]
    sessionTracks?: Record<string, unknown>[]
    layout?: LayoutNode
    sessionName?: string
  },
  pluginManager: PluginManager,
) {
  const rootModel = pluginManager.rootModel!

  try {
    rootModel.setSession?.({
      name: sessionName ?? `New session ${new Date().toLocaleString()}`,
    })

    const { session } = rootModel
    // Assemblies first: sessionTracks and the views below reference them by
    // name, so a self-contained spec (novel assemblies + their tracks, no
    // hosted config) resolves only if the assemblies exist before either runs.
    if (isSessionWithAddAssembly(session)) {
      for (const assembly of sessionAssemblies) {
        session.addSessionAssembly(assembly)
      }
    }
    if (isSessionWithAddTracks(session)) {
      for (const track of sessionTracks) {
        session.addTrackConf(track)
      }
    }

    // a view type with no registered LaunchView-<type> extension point (a
    // typo, or a plugin that wasn't loaded) makes evaluateAsyncExtensionPoint
    // a silent no-op, leaving an empty session with no diagnostic
    const unknownViewTypes = [
      ...new Set(
        views.flatMap(view =>
          pluginManager.extensionPoints.has(`LaunchView-${view.type}`)
            ? []
            : [view.type],
        ),
      ),
    ]
    if (unknownViewTypes.length) {
      rootModel.session?.notifyError(
        `Unknown view type(s) in session spec: ${unknownViewTypes.join(', ')}. The plugin providing the view may be missing, or the type may be misspelled.`,
      )
    }

    // Launch sequentially and record the id each spec view created, so the
    // layout below can map its indices to real views. Reading session.views
    // positionally afterwards only works while every handler happens to addView
    // synchronously and in order; capturing the delta per launch instead is
    // correct even if a handler awaits or adds an auxiliary view, and lets a
    // later spec view (e.g. a connected MsaView) reference an earlier one that
    // now already exists. `type` is the dispatch key, not view init data:
    // forwarding it would land in the view's declarative init blob and trip the
    // spurious "init ignored unknown key(s): type" warning meant to catch typos.
    const sessionViews = () =>
      (rootModel.session as unknown as { views?: { id: string }[] }).views ?? []
    const createdViewIds: (string | undefined)[] = []
    for (const { type, ...view } of views) {
      const before = new Set(sessionViews().map(v => v.id))
      // Strict so a launch handler that throws (missing/invalid assembly,
      // unresolved track, ...) surfaces as a snackbar instead of being swallowed
      // by the plain extension-point runner, which would leave a silent empty
      // session. A handler that legitimately no-ops returns normally and is
      // unaffected. Per-view try/catch so one bad view doesn't abort the rest.
      try {
        await pluginManager.evaluateAsyncExtensionPointStrict(
          `LaunchView-${type}`,
          {
            ...view,
            session: rootModel.session,
          },
        )
      } catch (e) {
        console.error(e)
        rootModel.session?.notifyError(`Failed to launch ${type} view: ${e}`, e)
      }
      createdViewIds.push(sessionViews().find(v => !before.has(v.id))?.id)
    }

    // Apply layout if specified
    if (layout) {
      // Cast through unknown since AbstractSessionModel doesn't include workspace types
      const session = rootModel.session as unknown as {
        setUseWorkspaces: (value: boolean) => void
        setInit: (init: DockviewLayoutNode | undefined) => void
      }

      // Enable workspaces mode for this session only — a spec URL shouldn't
      // rewrite the visitor's own preference
      session.setUseWorkspaces(true)

      // Convert layout from view indices to view IDs and set init
      session.setInit(convertLayoutNode(layout, createdViewIds))
    }
  } catch (e) {
    console.error(e)
    rootModel.session?.notifyError(`${e}`, e)
  }
}
