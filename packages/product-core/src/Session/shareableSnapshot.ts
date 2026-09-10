import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * The session snapshot to hand to anyone else — a share link, an exported
 * `session.json`, a desktop→web export. Snapshotting and baking are one call so
 * the pair can't be split: a bare `getSnapshot(session)` is never a correct
 * outgoing snapshot (see `bakeSessionCascades`), and three of the four
 * boundaries were spelling the two steps out identically.
 *
 * The fourth (desktop `ExportToWebDialog`) bakes a *transformed* snapshot from
 * `planWebExport`, so it calls `bakeSessionCascades` directly.
 */
export function getShareableSessionSnapshot(session: AbstractSessionModel) {
  return bakeSessionCascades(
    session,
    getSnapshot(session) as Record<string, unknown>,
  )
}

/**
 * Everything an outgoing snapshot has to resolve because the live session
 * resolves it at read time against state that is staying behind — currently the
 * workspaces intent alone.
 *
 * It keeps its own entry point rather than being inlined into the one caller
 * because the failure of a boundary that performs half of them is invisible at
 * that boundary: the export succeeds, and what is missing only shows up on
 * someone else's screen.
 */
export function bakeSessionCascades(
  session: AbstractSessionModel,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const snap = structuredClone(snapshot)
  bakeWorkspacesIntent(session, snap)
  return snap
}

/**
 * The workspaces cascade: session property -> user preference -> admin
 * `configuration.preferences.useWorkspaces`, of which only the first is in the
 * snapshot.
 *
 * So a sender whose workspace is on because *their admin turned it on* exports
 * a fully arranged `layout` with no statement that it is a workspace at all,
 * and a recipient resolving their own cascade to false renders the classic
 * stack: the arrangement arrives intact and invisible, with nothing to say it
 * was dropped.
 *
 * Only the on case is baked. At `false` there is no arrangement to carry, so
 * stamping it would be a sender with nothing to say overriding a recipient who
 * prefers workspaces.
 *
 * The paths that build a layout through an explicit user intent already set the
 * property themselves (`setUseWorkspacesPreference`, ViewMenu's move-view-out,
 * a spec `layout`), which is exactly what hides this: every arrangement made by
 * a *drag* — split a cell, drag a tab into it, open a new tab — goes through
 * `WorkspaceLayoutMixin` alone, which owns the tree and knows nothing about the
 * preference.
 *
 * `effectiveUseWorkspaces` is read behind an `in` guard because
 * `AbstractSessionModel` cannot name it (it lives on MultipleViewsSessionMixin,
 * one layer up), so renaming that getter silently stops the bake rather than
 * failing to compile — the hazard app-core/src/WorkspaceLayout/CLAUDE.md describes for
 * `setPendingMove`. jbrowse-web's `sessionModel/exportLayout.test.ts` is the
 * canary, since the bake needs a real session to have a cascade at all.
 */
function bakeWorkspacesIntent(
  session: AbstractSessionModel,
  snap: Record<string, unknown>,
) {
  if (
    snap.useWorkspaces === undefined &&
    'effectiveUseWorkspaces' in session &&
    (session as { effectiveUseWorkspaces?: unknown }).effectiveUseWorkspaces ===
      true
  ) {
    snap.useWorkspaces = true
  }
}
