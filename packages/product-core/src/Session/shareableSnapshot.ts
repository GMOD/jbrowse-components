import {
  getConf,
  getDisplayTypeDefaultChanges,
  openPromotableDisplays,
} from '@jbrowse/core/configuration'
import { getContainingTrack, mergeTrackConfig } from '@jbrowse/core/util'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { AbstractSessionModel } from '@jbrowse/core/util'

/**
 * The session snapshot to hand to anyone else — a share link, an exported
 * `session.json`, a desktop→web export. Snapshotting and baking are one call so
 * the pair can't be split: a bare `getSnapshot(session)` is never a correct
 * outgoing snapshot (see `bakePromotedDefaultsIntoSnapshot`), and three of the
 * four boundaries were spelling the two steps out identically.
 *
 * The fourth (desktop `ExportToWebDialog`) bakes a *transformed* snapshot from
 * `planWebExport`, so it calls `bakePromotedDefaultsIntoSnapshot` directly.
 */
export function getShareableSessionSnapshot(session: AbstractSessionModel) {
  return bakePromotedDefaultsIntoSnapshot(
    session,
    getSnapshot(session) as Record<string, unknown>,
  )
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
 *   - every slot an open display *inherits* from a promoted default (i.e.
 *     `getDisplayTypeDefaultChanges` — non-customized, differs from base) is
 *     baked into that track's config layer (`sessionTracks` for a user-added
 *     track, else a `trackConfigDeltas` entry against the admin base), so the
 *     concrete value travels with the document;
 *   - every open display is marked `ignorePromotedDefaults`, so the *recipient's*
 *     own promoted defaults can't repaint what the sender saw — including the
 *     case a baked value coincides with the schema default and would otherwise
 *     strip back to at-default and re-inherit on the other side.
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
  const bakes: Bake[] = []
  const openDisplayIds = new Set<string>()

  // one shared walk with the cascade's own "apply to open tracks", so the set
  // this bakes and the set that acts on a promoted default can't drift
  for (const display of openPromotableDisplays(session)) {
    const displayId = getConf(display, 'displayId') as string
    openDisplayIds.add(displayId)
    const changes = getDisplayTypeDefaultChanges(display)
    if (changes.length > 0) {
      bakes.push({
        trackId: getConf(getContainingTrack(display), 'trackId') as string,
        displayId,
        displayType: display.type,
        values: Object.fromEntries(changes.map(c => [c.path[0], c.to])),
      })
    }
  }

  markIgnorePromotedDefaults(snap, openDisplayIds)
  for (const bake of bakes) {
    bakeValues(snap, bake)
  }
  return snap
}

// A display state serializes its `configuration` reference as the displayId
// string; stamp `ignorePromotedDefaults` on every open one so the recipient
// resolves it from its own config only.
//
// Identifies its targets purely by that id, walking the snapshot structurally
// rather than following views -> tracks -> displays. Nothing else in a session
// snapshot carries a displayId under `configuration`, and matching on the ids
// `openPromotableDisplays` already collected means this can't reach a display
// that walk didn't. That's the point: a shape-aware second walk had to be kept
// in step with the first by hand, and a composite view it forgot to recurse into
// got its values baked but not the flag — the values without the flag are the
// half that silently loses to a recipient's own promoted default.
function markIgnorePromotedDefaults(node: unknown, openDisplayIds: Set<string>) {
  if (Array.isArray(node)) {
    for (const child of node) {
      markIgnorePromotedDefaults(child, openDisplayIds)
    }
  } else if (isRecord(node)) {
    if (
      typeof node.configuration === 'string' &&
      openDisplayIds.has(node.configuration)
    ) {
      node.ignorePromotedDefaults = true
    }
    for (const child of Object.values(node)) {
      markIgnorePromotedDefaults(child, openDisplayIds)
    }
  }
}

// Bake one display's inherited values into the config layer: into the matching
// `sessionTracks` display for a user-added track, else merged as a
// `trackConfigDeltas` entry against the admin base.
function bakeValues(snap: Record<string, unknown>, bake: Bake) {
  const partialDisplay = {
    type: bake.displayType,
    displayId: bake.displayId,
    ...bake.values,
  }
  const sessionTrack = asArray(snap.sessionTracks).find(
    t => isRecord(t) && t.trackId === bake.trackId,
  )
  if (isRecord(sessionTrack)) {
    const displays = asArray(sessionTrack.displays)
    const target = displays.find(
      d => isRecord(d) && d.displayId === bake.displayId,
    )
    if (isRecord(target)) {
      Object.assign(target, bake.values)
    } else {
      sessionTrack.displays = [...displays, partialDisplay]
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}
