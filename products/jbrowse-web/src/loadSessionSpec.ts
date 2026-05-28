import { isSessionWithAddTracks } from '@jbrowse/core/util'

import type { LayoutNode, ViewSpec } from './types.ts'
import type { DockviewLayoutNode } from '@jbrowse/app-core'
import type PluginManager from '@jbrowse/core/PluginManager'

// Convert LayoutNode (with view indices) to DockviewLayoutNode (with view IDs)
function convertLayoutNode(
  node: LayoutNode,
  views: { id: string }[],
): DockviewLayoutNode {
  if (node.views !== undefined) {
    // Panel node - convert view indices to view IDs
    const viewIds = node.views
      .map(idx => views[idx]?.id)
      .filter((id): id is string => id !== undefined)
    return { viewIds, size: node.size }
  }
  if (node.children) {
    // Container node - recursively convert children
    return {
      direction: node.direction,
      children: node.children.map(child => convertLayoutNode(child, views)),
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
    sessionTracks = [],
    layout,
    sessionName,
  }: {
    views: ViewSpec[]
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
        views
          .map(view => view.type)
          .filter(
            type => !pluginManager.extensionPoints.has(`LaunchView-${type}`),
          ),
      ),
    ]
    if (unknownViewTypes.length) {
      rootModel.session?.notifyError(
        `Unknown view type(s) in session spec: ${unknownViewTypes.join(', ')}. The plugin providing the view may be missing, or the type may be misspelled.`,
      )
    }

    await Promise.all(
      views.map(view =>
        pluginManager.evaluateAsyncExtensionPoint(`LaunchView-${view.type}`, {
          ...view,
          session: rootModel.session,
        }),
      ),
    )

    // Apply layout if specified
    if (layout) {
      // Cast through unknown since AbstractSessionModel doesn't include workspace types
      const session = rootModel.session as unknown as {
        views: { id: string }[]
        useWorkspaces: boolean
        setUseWorkspaces: (value: boolean) => void
        setInit: (init: DockviewLayoutNode | undefined) => void
      }

      // Enable workspaces mode
      session.setUseWorkspaces(true)

      // Convert layout from view indices to view IDs and set init
      session.setInit(convertLayoutNode(layout, session.views))
    }
  } catch (e) {
    console.error(e)
    rootModel.session?.notifyError(`${e}`, e)
  }
}
