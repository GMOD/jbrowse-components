import {
  getConf,
  getDisplayTypeDefaultChanges,
} from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  mergeTrackConfig,
  openPromotableDisplays,
} from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import { asArray, isRecord } from '../snapshotUtils.ts'

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
 * resolves it at read time against state that is staying behind.
 *
 * Two such cascades, and they have nothing to do with each other — promoted
 * display-type defaults are per-track rendering, workspaces intent is the
 * session's layout mode. What they share is only this: both live partly in the
 * sender's own browser, so a raw `getSnapshot` records neither, and the
 * recipient silently resolves their own.
 *
 * They get one entry point rather than a call each because the failure of a
 * boundary that performs half of them is invisible at that boundary — the
 * export succeeds, and what is missing only shows up on someone else's screen.
 * Adding a third cascade should mean editing this function, not auditing four
 * call sites.
 */
export function bakeSessionCascades(
  session: AbstractSessionModel,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const snap = bakePromotedDefaultsIntoSnapshot(session, snapshot)
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
 * prefers workspaces — the same line the promoted-default bake draws at a slot
 * the sender was viewing at its base value.
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

interface Bake {
  trackId: string
  displayId: string
  displayType: string
  values: Record<string, unknown>
}

/**
 * `getComputedStyle` for the promotable-default cascade.
 *
 * A track that "follows" a session-wide promoted display-type default holds no
 * value of its own — its rendered value is resolved at read time from the
 * promoted display-type defaults in `preferencesOverrides`, which are personal,
 * localStorage-backed, and deliberately never serialized into a shared session.
 * So a raw `getSnapshot(session)` records a track as at-default even when the
 * sender is looking at a promoted value, and the recipient (who lacks the sender's
 * preferences) sees something different. This flattens the live cascade into a
 * self-contained snapshot:
 *
 * Every slot an open display *inherits* from a promoted default (i.e.
 * `getDisplayTypeDefaultChanges` — non-customized, differs from base) is baked
 * into that track's config layer: its own config for a user-added or connection
 * track, else a `trackConfigDeltas` entry against the admin base (see
 * `ownTrackConfig`). So the concrete value travels with the document, and
 * because it lands in the track's config the recipient reads it as *customized*
 * — a customized value is the top of the cascade, so their own promoted defaults
 * never get consulted for it.
 *
 * **What this deliberately does not cover**, and the reason there is no flag
 * here: a slot the sender was viewing at its *base* value. Nothing is baked for
 * it (the value equals base, and `stripDefault` drops it from the snapshot
 * regardless), so a recipient who has promoted something else resolves it from
 * their own cascade and sees their value. There is no value that can express "I
 * deliberately saw the default" — at-base and unset are byte-identical once
 * stripped. That case used to be covered by stamping a per-display
 * `ignorePromotedDefaults` on every open display, which cost a second
 * shape-aware walk that had to stay in step with `openPromotableDisplays` by
 * hand, and permanently detached received tracks from the recipient's own pins
 * until they clicked "use this default" on each one. A promoted default is
 * personal and local — the same as the theme a session is viewed in, which this
 * function has never baked either.
 *
 * The live session is untouched; a modified deep copy of `snapshot` is returned.
 * Tracks the sender never opened carry no display state to resolve, so they're
 * left to pick up the recipient's defaults when opened — matching "export the
 * actual state of the (open) tracks".
 *
 * Reach is `openPromotableDisplays` — literally the same walk the cascade's own
 * "apply to open tracks" uses, so the two can't drift. It recurses into a
 * composite view's `views` array (breakpoint-split, the linear-comparative /
 * synteny family), which holds child views rather than tracks of its own —
 * `LGVSyntenyDisplay` is only reachable that way, and before the recursion a
 * shared session containing one rendered differently for the recipient.
 */
export function bakePromotedDefaultsIntoSnapshot(
  session: AbstractSessionModel,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const snap = structuredClone(snapshot)
  // `openPromotableDisplays` is the one walk that decides reach — shared with
  // the cascade's own "apply to open tracks", so the set this bakes and the set
  // that acts on a promoted default can't drift
  for (const display of openPromotableDisplays(session)) {
    const changes = getDisplayTypeDefaultChanges(display)
    if (changes.length > 0) {
      bakeValues(snap, {
        trackId: getConf(getContainingTrack(display), 'trackId') as string,
        displayId: getConf(display, 'displayId') as string,
        displayType: display.type,
        values: Object.fromEntries(changes.map(c => [c.path[0], c.to])),
      })
    }
  }
  return snap
}

// The track's own full config in the snapshot, when it has one: a user-added
// track's `sessionTracks` entry, or an opened connection track's persisted
// `connectionTrackConfigs` config. Everything else is an admin-base track,
// which carries only a delta.
//
// The connection case is not optional. `trackConfigDeltas` is merged over
// `jbrowse.tracks` alone, so a delta written for a connection track resolves
// nowhere — the recipient would render the base value, which is the exact
// failure the bake exists to prevent. `updateTrackConfiguration` splits on the
// same line.
function ownTrackConfig(snap: Record<string, unknown>, trackId: string) {
  const sessionTrack = asArray(snap.sessionTracks).find(
    t => isRecord(t) && t.trackId === trackId,
  )
  const connectionEntry = isRecord(snap.connectionTrackConfigs)
    ? snap.connectionTrackConfigs[trackId]
    : undefined
  return isRecord(sessionTrack)
    ? sessionTrack
    : isRecord(connectionEntry) && isRecord(connectionEntry.config)
      ? connectionEntry.config
      : undefined
}

// Bake one display's inherited values into the config layer: into the matching
// display of the track's own config when it has one, else merged as a
// `trackConfigDeltas` entry against the admin base.
function bakeValues(snap: Record<string, unknown>, bake: Bake) {
  const partialDisplay = {
    type: bake.displayType,
    displayId: bake.displayId,
    ...bake.values,
  }
  const ownConfig = ownTrackConfig(snap, bake.trackId)
  if (ownConfig) {
    const displays = asArray(ownConfig.displays)
    const target = displays.find(
      d => isRecord(d) && d.displayId === bake.displayId,
    )
    if (isRecord(target)) {
      Object.assign(target, bake.values)
    } else {
      ownConfig.displays = [...displays, partialDisplay]
    }
  } else {
    const deltas = isRecord(snap.trackConfigDeltas)
      ? { ...snap.trackConfigDeltas }
      : {}
    const existing = isRecord(deltas[bake.trackId])
      ? (deltas[bake.trackId] as Record<string, unknown>)
      : { trackId: bake.trackId }
    deltas[bake.trackId] = mergeTrackConfig(existing, {
      trackId: bake.trackId,
      displays: [partialDisplay],
    })
    snap.trackConfigDeltas = deltas
  }
}
