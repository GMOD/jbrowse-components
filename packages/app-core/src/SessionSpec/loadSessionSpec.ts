import {
  isSessionWithAddAssembly,
  isSessionWithAddSessionTrack,
} from '@jbrowse/core/util'
import {
  legacyInitMessage,
  unknownKeysMessage,
} from '@jbrowse/core/util/withLaunchInput'
import { isAlive, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { when } from 'mobx'

import type { LayoutSpecNode } from '../WorkspaceLayout/spec.ts'
import type { LayoutNode, ViewSpec } from './types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// A spec `layout` needs both session mixins that own workspaces state:
// WorkspaceLayoutMixin's `applyLayoutSpec` and MultipleViewsSessionMixin's
// `setUseWorkspaces` and `orderViews`. A session without them (an embedded
// product) can't honor a layout, which is worth saying rather than throwing
// mid-load.
//
// The members named here have to move with their mixins. They are looked up at
// runtime behind the `in` guard below, so renaming the action without renaming
// it here does not fail to compile and does not throw — the guard just goes
// false and every spec layout is silently declined. That is exactly how
// `setPendingMove` broke once already; see app-core/src/WorkspaceLayout/CLAUDE.md.
interface SessionWithWorkspaceLayout {
  setUseWorkspaces: (useWorkspaces: boolean) => void
  applyLayoutSpec: (spec: LayoutSpecNode) => string[]
  orderViews: (ids: string[]) => void
}
function isSessionWithWorkspaceLayout(
  session: AbstractSessionModel,
): session is AbstractSessionModel & SessionWithWorkspaceLayout {
  return (
    'applyLayoutSpec' in session &&
    'setUseWorkspaces' in session &&
    'orderViews' in session
  )
}

// A spec `sessionConnections` needs a session that can both register a
// connection config and instantiate it. Declared here rather than reused from
// core's SessionWithConnectionEditing because a spec carries plain JSON
// snapshots rather than built config models, and because `silent` — the option
// that stops a connection opening its own view over the spec's — is a web
// session's, not the base interface's.
interface SessionWithSpecConnections {
  // `addConnectionConf` puts the config wherever *this user's* edits go, which
  // in jbrowse-web's admin mode is the config.json served to everyone. A spec
  // key named `sessionConnections` means the session, whoever is looking, so
  // prefer the session-scoped adder where the application has one. Everywhere
  // else (Desktop, the embedded products) there is only one place a connection
  // can live and `addConnectionConf` is it.
  addSessionConnectionConf?: (
    conf: Record<string, unknown>,
  ) => AnyConfigurationModel
  addConnectionConf: (conf: Record<string, unknown>) => AnyConfigurationModel
  makeConnection: (
    conf: AnyConfigurationModel,
    initialSnapshot?: { silent?: boolean },
  ) => void
  connectionInstances: { loading: boolean }[]
}
function isSessionWithSpecConnections(
  session: AbstractSessionModel,
): session is AbstractSessionModel & SessionWithSpecConnections {
  return (
    'addConnectionConf' in session &&
    'makeConnection' in session &&
    'connectionInstances' in session
  )
}

/**
 * Register `&sessionTracks=` / a spec's `sessionTracks` into a session.
 *
 * Exported because the hub launch needs it too and must not reimplement it.
 *
 * A track that fails to register does not cost the caller the rest of them —
 * same reasoning as the per-connection and per-view try/catch around it, one
 * layer down.
 */
export function addSessionTracks(
  session: AbstractSessionModel | undefined,
  tracks: Record<string, unknown>[],
) {
  if (!tracks.length) {
    return
  }
  if (!isSessionWithAddSessionTrack(session)) {
    session?.notifyError(
      'This link has "sessionTracks", but this application cannot add tracks to a session',
    )
    return
  }
  for (const track of tracks) {
    const label = typeof track.trackId === 'string' ? track.trackId : '?'
    try {
      session.addSessionTrackConf(track)
    } catch (e) {
      console.error(e)
      session.notifyError(
        `Track "${label}" has an invalid configuration: ${e}`,
        e,
      )
    }
  }
}

// A connection supplies assemblies and tracks that the spec's views go on to
// reference by name, and it supplies them from a fetch. Launching a view before
// that fetch lands gives it an assembly that doesn't exist yet ("Assembly X not
// found") and a `tracks` list whose ids don't resolve yet.
//
// Causal, not timed: every connection reports `loading` from its own
// afterAttach until its connect() promise settles, success or failure, so this
// proceeds the moment the last one is done and never waits on one that failed.
// A session destroyed mid-wait (a StrictMode remount, a session swap) resolves
// it too — reading a detached node throws, and here that would land in the
// caller's catch and report a spurious error against the *new* session.
async function whenConnectionsSettle(
  session: AbstractSessionModel & SessionWithSpecConnections,
) {
  // isStateTreeNode first: the liveness question only applies to a real MST
  // session, and this is called with plain object sessions under test
  const gone = () => isStateTreeNode(session) && !isAlive(session)
  await when(
    () => gone() || session.connectionInstances.every(conn => !conn.loading),
  )
  return !gone()
}

// Resolve a spec layout's view indexes to ids before `applyLayoutSpec` counts
// them into `session.views`, which is a different list: a spec index names a
// spec entry, and `createdViewIds[i]` is EVERY view the i-th entry created, in
// creation order. A connected ProteinView creates its genome view and then
// itself, and the index names both — stacked in one cell — where recording one
// id per entry left the structure unaddressable, in no cell, and the panel
// naming it empty. A string is a view id and passes through; a reference that
// resolves to nothing is dropped here after `unresolvedLayoutRefs` reported it.
function convertLayoutNode(
  node: LayoutNode,
  createdViewIds: string[][],
  knownIds: Set<string>,
  pinnedIds: Set<string>,
): LayoutSpecNode {
  const { views, children, ...rest } = node
  return {
    ...rest,
    ...(views === undefined
      ? {}
      : {
          views: Array.isArray(views)
            ? views.flatMap(ref =>
                typeof ref === 'number'
                  ? (createdViewIds[ref] ?? []).filter(id => !pinnedIds.has(id))
                  : knownIds.has(ref)
                    ? [ref]
                    : [],
              )
            : views,
        }),
    ...(children === undefined
      ? {}
      : {
          children: Array.isArray(children)
            ? children.map(child =>
                convertLayoutNode(child, createdViewIds, knownIds, pinnedIds),
              )
            : children,
        }),
  }
}

// An index names every view its entry created, so the entry that opens a genome
// view beside its own puts BOTH in the cell naming it — which is the point, and
// is wrong the moment another cell names one of them by id. `{views:[0]}` next
// to `{views:['structure']}` is the obvious spelling of "genome left, structure
// right", and expanding the index blind seats the structure in both cells: two
// React trees and two GPU contexts for one model, which `resolveLayoutSpec` now
// refuses outright. An id stated by hand is the more specific statement, so it
// wins its view and the index gives it up.
function pinnedLayoutIds(node: LayoutNode, knownIds: Set<string>): string[] {
  return [
    ...(Array.isArray(node.views)
      ? node.views.filter(
          (ref): ref is string => typeof ref === 'string' && knownIds.has(ref),
        )
      : []),
    ...(Array.isArray(node.children)
      ? node.children.flatMap(child => pinnedLayoutIds(child, knownIds))
      : []),
  ]
}

// A layout index is a position in the spec's `views` array, so one past the end
// (or negative) is an authoring slip that would otherwise silently drop that
// view from the layout, or, if every reference in a panel is bad, leave an
// empty panel with no clue why. An id names a view pinned with the spec's `id`
// key, so one nothing created is the same slip.
function unresolvedLayoutRefs(
  node: LayoutNode,
  viewCount: number,
  knownIds: Set<string>,
): (number | string)[] {
  // Array-guarded rather than `?.`: a hand-written `views: 0` is non-nullish,
  // so `?.` does not short-circuit and `(0).filter` threw a raw TypeError out
  // of this validator — past `resolveLayoutSpec`, which has a real message for
  // that exact slip and never got to say it.
  return [
    ...(Array.isArray(node.views)
      ? node.views.filter(ref =>
          typeof ref === 'number'
            ? ref < 0 || ref >= viewCount
            : !knownIds.has(ref),
        )
      : []),
    ...(Array.isArray(node.children)
      ? node.children.flatMap(child =>
          unresolvedLayoutRefs(child, viewCount, knownIds),
        )
      : []),
  ]
}

// A `tabs` node shares one cell between its children rather than dividing the
// space, so a `size` on one of them describes nothing. This is the ONLY case
// left where a stated size is dropped.
//
// It used to be far wider — dockview forces its branches to alternate
// orientation by depth, so a nested container had no branch to size against and
// the whole sizing pass bailed, top-level numbers included. That is gone
// (ADR-068): the spec's nesting is the tree's nesting, `size` applies wherever
// it is written, and a bare sibling takes an equal share of the remainder. The
// wider check outlived the limitation it reported and told an author their
// nested or partial sizes had been ignored while the layout honoured them —
// which is also what website/docs/urlparams.md promises.
function unsizeableLayoutNodes(layout: LayoutNode): boolean {
  const children = Array.isArray(layout.children) ? layout.children : []
  const sizedTabsChild =
    layout.direction === 'tabs' && children.some(c => c.size !== undefined)
  return sizedTabsChild || children.some(unsizeableLayoutNodes)
}

// The other statement a `tabs` node cannot take literally, and the one that
// used to fail silently rather than partially: a tab holds a FLAT stack of
// views, so a container child has no split to become. Containers nest
// arbitrarily deep everywhere else — the docs say so — which is what makes one
// here easy to write. Its views are flattened into a single tab now; they used
// to be dropped from the layout, after which homing swept them into whichever
// tab happened to be showing, so the arrangement was wrong with nothing said.
function flattenedTabsContainers(layout: LayoutNode): boolean {
  const children = Array.isArray(layout.children) ? layout.children : []
  const nestedTabsChild =
    layout.direction === 'tabs' && children.some(c => c.children !== undefined)
  return nestedTabsChild || children.some(flattenedTabsContainers)
}

// use extension point named e.g. LaunchView-LinearGenomeView to initialize an
// LGV session
export async function loadSessionSpec(
  {
    views,
    sessionAssemblies = [],
    sessionConnections = [],
    sessionTracks = [],
    layout,
    sessionName,
  }: {
    views: ViewSpec[]
    sessionAssemblies?: Record<string, unknown>[]
    sessionConnections?: Record<string, unknown>[]
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
    // Connections after the assemblies (a connection config may name one the
    // spec defines) and before the tracks and views, which are what reference
    // the assemblies and tracks a connection brings in.
    if (sessionConnections.length) {
      if (session && isSessionWithSpecConnections(session)) {
        // A connection type nothing registered is a typo or a missing plugin,
        // the same authoring slip the view check below reports. Caught here
        // because the config would otherwise fail the connection array's MST
        // union check and throw past every per-key guard to the catch at the
        // bottom, costing the spec its tracks, its views and its layout over
        // one bad entry — and reporting it as a raw union-type dump.
        const connectionTypes = pluginManager.getElementTypeRecord('connection')
        for (const conf of sessionConnections) {
          const { type } = conf
          const label =
            typeof conf.connectionId === 'string' ? conf.connectionId : '?'
          if (typeof type !== 'string' || !connectionTypes.has(type)) {
            session.notifyError(
              `Session spec connection "${label}" has ${
                typeof type === 'string'
                  ? `unknown type "${type}". The plugin providing the connection may be missing, or the type may be misspelled.`
                  : 'no "type".'
              }`,
            )
            continue
          }
          // Per-connection, for the same reason each view gets its own: one
          // unusable connection shouldn't cost the spec everything after it.
          try {
            // silent whenever the spec launches views of its own: a connection
            // that opens one on connect (a single-file UCSC hub goes to its
            // `defaultPos`) would otherwise open a second view competing with
            // the one the spec asked for. With no views the spec is only asking
            // to attach the connection, so let it do its own thing.
            session.makeConnection(
              session.addSessionConnectionConf
                ? session.addSessionConnectionConf(conf)
                : session.addConnectionConf(conf),
              { silent: views.length > 0 },
            )
          } catch (e) {
            console.error(e)
            session.notifyError(
              `Connection "${label}" has an invalid configuration: ${e}`,
              e,
            )
          }
        }
      } else {
        session?.notifyError(
          'Session spec has "sessionConnections", but this application cannot add connections to a session',
        )
      }
    }
    addSessionTracks(session, sessionTracks)

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

    // v4 nested a view's settings under `init`. A spec never becomes a
    // snapshot, so `withLaunchInput`'s unwrap never runs on one and this
    // surface does it itself, in the same order: the flat spelling wins.
    const specViews = views.map(({ init, ...view }) => {
      if (init) {
        console.warn(legacyInitMessage(view.type))
      }
      return init ? { ...init, ...view } : view
    })

    // The same classification a view snapshot gets, run here because a spec
    // never becomes one: `LaunchView-<type>` takes these keys as arguments, so
    // `withLaunchInput`'s partition never sees them and nothing names a typo.
    // `{type: 'LinearGenomeView', asembly: 'volvox'}` reported only the
    // launcher's downstream "No assembly provided", on the one surface written
    // by hand with no compiler and no editor behind it.
    //
    // An ERROR rather than the snapshot path's warning: this surface's
    // misplaced keys already report as errors, and the launcher's own failure
    // lands as an error a line later — a warning under it reads as the lesser
    // of the two, when it is the cause.
    //
    // A view type that registers no launch keys classifies nothing: its
    // launcher's vocabulary is undeclared, so every argument would read as a
    // typo.
    for (const { type, ...view } of specViews) {
      const accepted = viewTypes.has(type)
        ? pluginManager.getViewType(type).acceptedKeys
        : undefined
      const unknown = accepted
        ? Object.keys(view).filter(key => !accepted.includes(key))
        : []
      if (unknown.length) {
        session?.notifyError(unknownKeysMessage(type, unknown))
      }
    }

    // Launch sequentially and record the id each spec view created, so the
    // layout below can map its indices to real views. Reading session.views
    // positionally afterwards only works while every handler happens to addView
    // synchronously and in order; capturing the delta per launch instead is
    // correct even if a handler awaits or adds an auxiliary view, and lets a
    // later spec view (e.g. a connected MsaView) reference an earlier one that
    // now already exists. `type` is the dispatch key, not a setting: forwarding
    // it would land in the view's launch blob and trip the spurious
    // "ignored unknown key(s): type" warning meant to catch typos.
    // `displayName` is applied here rather than forwarded because it is a base
    // view prop every view type has, so one path covers all of them (including
    // plugin-provided types whose launcher never heard of it).
    // Let any connection this spec registered finish before the views that
    // reference what it supplies are launched (see whenConnectionsSettle). Gated
    // on there being views: with none, nothing is waiting on the connection, and
    // holding the load open until a hub finishes fetching would be pure delay —
    // the connection is the deliverable. A session that went away while we
    // waited has nothing left to launch into.
    if (
      sessionConnections.length &&
      views.length &&
      session &&
      isSessionWithSpecConnections(session) &&
      !(await whenConnectionsSettle(session))
    ) {
      return
    }

    const createdViewIds: string[][] = []
    for (const { type, displayName, ...view } of specViews) {
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
      const created = session?.views.filter(v => !before.has(v.id)) ?? []
      // The entry's own view, when its launcher created others beside it: a
      // connected ProteinView's name went to the genome view it opened first,
      // and the structure came up "Untitled view".
      const named = created.find(v => v.type === type) ?? created[0]
      if (named && displayName) {
        named.setDisplayName(displayName)
      }
      createdViewIds.push(created.map(v => v.id))
    }

    if (layout && session) {
      const knownIds = new Set(createdViewIds.flat())
      const bad = unresolvedLayoutRefs(layout, views.length, knownIds)
      const badIndices = bad.filter(ref => typeof ref === 'number')
      const badIds = bad.filter(ref => typeof ref === 'string')
      if (badIndices.length) {
        session.notifyError(
          `Session spec layout references view index ${badIndices.join(', ')}, but the spec has ${views.length} view(s).`,
        )
      }
      if (badIds.length) {
        session.notifyError(
          `Session spec layout references view id ${badIds.map(id => `"${id}"`).join(', ')}, but no view in the spec has that id (a view's "id" key pins it).`,
        )
      }
      if (unsizeableLayoutNodes(layout)) {
        session.notify(
          'Session spec layout: a "tabs" node shares one cell between its children rather than dividing the space, so the "size" on them was ignored. The rest of the layout is unaffected.',
          'info',
        )
      }
      if (flattenedTabsContainers(layout)) {
        session.notify(
          'Session spec layout: a "tabs" node gives each child one tab, and a tab holds a flat stack of views — so a container inside one was flattened into a single tab rather than splitting it. The rest of the layout is unaffected.',
          'info',
        )
      }
      if (isSessionWithWorkspaceLayout(session)) {
        // Enable workspaces mode for this session only — a spec URL shouldn't
        // rewrite the visitor's own preference
        session.setUseWorkspaces(true)
        // A tab's `viewIds` is membership, not order: a tab renders its views
        // in `session.views` order (WorkspaceContainer's `viewsOf`, and
        // `viewIdsForTab`). So the top-to-bottom order a spec panel states —
        // `viewIds` is documented as "the views to stack vertically in one tab"
        // — only takes effect if it is applied to `session.views`, which is
        // what `applyLayoutSpec`'s return value is for. Drop this call and the
        // stated order is silently ignored: the tree holds it, nothing reads
        // it, and the views come back in launch order with no diagnostic.
        // Its own try/catch, the same reasoning as the per-view one above: the
        // resolver throws for a layout it will not arrange, and this is the
        // LAST thing the spec does — so an unarrangeable layout used to take
        // the whole load's catch, after `setUseWorkspaces(true)` had already
        // run, and report itself as the session's error with the views left
        // unordered. The layout is one statement in the spec; losing it should
        // cost the spec its layout and nothing else.
        try {
          session.orderViews(
            session.applyLayoutSpec(
              convertLayoutNode(
                layout,
                createdViewIds,
                knownIds,
                new Set(pinnedLayoutIds(layout, knownIds)),
              ),
            ),
          )
        } catch (e) {
          console.error(e)
          session.notifyError(`Session spec layout: ${e}`, e)
        }
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
