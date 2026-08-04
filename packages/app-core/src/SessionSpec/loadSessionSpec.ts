import {
  isSessionWithAddAssembly,
  isSessionWithAddTracks,
} from '@jbrowse/core/util'

import type { DockviewLayoutNode } from '../DockviewLayout/index.ts'
import type { LayoutNode, ViewSpec } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// A spec `layout` needs both session mixins that own workspaces state:
// DockviewLayoutMixin's `setInit` and MultipleViewsSessionMixin's
// `setUseWorkspaces`. A session without them (an embedded product) can't honor a
// layout, which is worth saying rather than throwing mid-load.
interface SessionWithWorkspaceLayout {
  setUseWorkspaces: (useWorkspaces: boolean) => void
  setInit: (init: DockviewLayoutNode | undefined) => void
}
function isSessionWithWorkspaceLayout(
  session: AbstractSessionModel,
): session is AbstractSessionModel & SessionWithWorkspaceLayout {
  return 'setInit' in session && 'setUseWorkspaces' in session
}

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

// A layout index is a position in the spec's `views` array, so one past the end
// (or negative) is an authoring slip that would otherwise silently drop that
// view from the layout, or, if every index in a panel is bad, leave an empty
// panel with no clue why.
function outOfRangeLayoutIndices(
  node: LayoutNode,
  viewCount: number,
): number[] {
  return [
    ...(node.views?.filter(idx => idx < 0 || idx >= viewCount) ?? []),
    ...(node.children?.flatMap(child =>
      outOfRangeLayoutIndices(child, viewCount),
    ) ?? []),
  ]
}

// `size` is only honoured on the top-level split, where every child is a
// sized panel: dockview's grid forces its branches to alternate orientation by
// depth, so a nested container in this tree has no single branch to size
// against. Silently dropping the numbers reads as "sizes don't work" (the whole
// pass bails, including the outer split's own sizes), so name what was ignored.
function unsizeableLayoutNodes(layout: LayoutNode): boolean {
  const hasNestedSize = (node: LayoutNode, depth: number): boolean =>
    (node.size !== undefined && depth > 1) ||
    (node.children?.some(child => hasNestedSize(child, depth + 1)) ?? false)

  const topLevelHonoured =
    layout.direction !== undefined &&
    layout.direction !== 'tabs' &&
    (layout.children?.every(
      c => c.views !== undefined && c.size !== undefined,
    ) ??
      false)

  return (
    hasNestedSize(layout, 0) ||
    (!topLevelHonoured &&
      (layout.children?.some(c => c.size !== undefined) ?? false))
  )
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

    // a view type with no registered LaunchView-<type> extension point makes
    // evaluateAsyncExtensionPoint a silent no-op, leaving an empty session with
    // no diagnostic. Two different causes, so two messages: the view type is
    // unknown here at all (a typo, or a plugin that wasn't loaded), or it exists
    // but nothing taught it how to launch from a spec, which the spec author
    // can't fix, only the view's plugin can.
    const notLaunchable = [
      ...new Set(
        views.flatMap(view =>
          pluginManager.extensionPoints.has(`LaunchView-${view.type}`)
            ? []
            : [view.type],
        ),
      ),
    ]
    // the record's `has`, not getElementType, which throws on an unregistered
    // name rather than returning undefined
    const viewTypes = pluginManager.getElementTypeRecord('view')
    const unknown = notLaunchable.filter(type => !viewTypes.has(type))
    const noLauncher = notLaunchable.filter(type => viewTypes.has(type))
    if (unknown.length) {
      session?.notifyError(
        `Unknown view type(s) in session spec: ${unknown.join(', ')}. The plugin providing the view may be missing, or the type may be misspelled.`,
      )
    }
    if (noLauncher.length) {
      session?.notifyError(
        `View type(s) ${noLauncher.join(', ')} cannot be launched from a session spec: no LaunchView extension point is registered for them.`,
      )
    }

    // The two ways of writing a view are not the same shape, and this is the
    // confusable pair:
    //
    // - a spec view is flat *arguments* to LaunchView-<type>, in that launcher's
    //   own vocabulary (a dotplot takes `views`, a spreadsheet takes `uri`), and
    //   the launcher sorts them into what the new view needs
    // - a config/defaultSession view is MST *state*, so keys that need resolving
    //   on load have nowhere to live but the view's own `init` property
    //
    // Reported rather than unwrapped here, deliberately: only a launcher knows
    // which of its keys are one-shot commands versus plain view props, so
    // flattening `init` centrally would erase that distinction and let a view prop
    // nested inside it be honored from a spec while the identical config drops it.
    // Teaching each launcher to accept both instead is per-view-type work that
    // every future launcher has to remember — the shapes then differ by view type,
    // which is worse than differing by surface. One check here covers every view
    // type, including plugin-provided ones. Without it the LGV reports the
    // downstream symptom, "No assembly provided", for a misplaced block.
    const nested = views.filter(view => 'init' in view).map(view => view.type)
    if (nested.length) {
      session?.notifyError(
        `Session spec view(s) ${nested.join(', ')} nest their settings under "init". A spec takes those keys flat (assembly, loc, tracks, …); "init" is the config/defaultSession form.`,
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
    // `displayName` is applied here rather than forwarded because it is a base
    // view prop every view type has, so one path covers all of them (including
    // plugin-provided types whose launcher never heard of it). A nested `init` is
    // NOT unwrapped the same way — see the diagnostic above for why.
    const createdViewIds: (string | undefined)[] = []
    for (const { type, displayName, ...view } of views) {
      const before = new Set(session?.views.map(v => v.id))
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
            session,
          },
        )
      } catch (e) {
        console.error(e)
        session?.notifyError(`Failed to launch ${type} view: ${e}`, e)
      }
      const created = session?.views.find(v => !before.has(v.id))
      if (created && displayName) {
        created.setDisplayName(displayName)
      }
      createdViewIds.push(created?.id)
    }

    if (layout && session) {
      const badIndices = outOfRangeLayoutIndices(layout, views.length)
      if (badIndices.length) {
        session.notifyError(
          `Session spec layout references view index ${badIndices.join(', ')}, but the spec has ${views.length} view(s).`,
        )
      }
      if (unsizeableLayoutNodes(layout)) {
        session.notify(
          'Session spec layout "size" is only applied when every panel of the top-level horizontal/vertical split carries one; the rest of the layout still builds, with those panels sharing the space evenly.',
          'info',
        )
      }
      if (isSessionWithWorkspaceLayout(session)) {
        // Enable workspaces mode for this session only — a spec URL shouldn't
        // rewrite the visitor's own preference
        session.setUseWorkspaces(true)
        session.setInit(convertLayoutNode(layout, createdViewIds))
      } else {
        session.notifyError(
          'Session spec has a "layout", but this application does not support workspace layouts',
        )
      }
    }
  } catch (e) {
    console.error(e)
    rootModel.session?.notifyError(`${e}`, e)
  }
}
