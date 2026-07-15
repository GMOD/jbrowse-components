import {
  getConf,
  getDisplayTypeDefaultChanges,
} from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  isViewContainer,
  mergeTrackConfig,
} from '@jbrowse/core/util'

import type { PromotableDisplay } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

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
 * value of its own — its rendered value is resolved at read time from
 * `preferencesOverrides.displayTypeDefaults`, which is personal, localStorage-
 * backed, and deliberately never serialized into a shared session. So a raw
 * `getSnapshot(session)` records a track as at-default even when the sender is
 * looking at a promoted value, and the recipient (who lacks the sender's
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
 * Reach is `session.views[].tracks[]` — the same set `openDisplaysOfType` (the
 * cascade's own "apply to open tracks") walks, so the two stay consistent. A
 * display nested inside a composite view (breakpoint-split, SV-inspector,
 * synteny read-vs-ref) is therefore not baked; that's an accepted limitation
 * shared with the rest of the subsystem, not a special case to add here.
 */
export function bakePromotedDefaultsIntoSnapshot(
  session: AbstractSessionModel,
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const snap = structuredClone(snapshot)
  if (!isViewContainer(session)) {
    return snap
  }

  const bakes: Bake[] = []
  const openDisplayIds = new Set<string>()

  for (const view of session.views) {
    if (!hasOpenTracks(view)) {
      continue
    }
    for (const track of view.tracks) {
      for (const display of track.displays) {
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
    }
  }

  markIgnorePromotedDefaults(snap.views, openDisplayIds)
  for (const bake of bakes) {
    bakeValues(snap, bake)
  }
  return snap
}

// A display state serializes its `configuration` reference as the displayId
// string; stamp `ignorePromotedDefaults` on every open one so the recipient
// resolves it from its own config only.
function markIgnorePromotedDefaults(
  views: unknown,
  openDisplayIds: Set<string>,
) {
  for (const view of asArray(views)) {
    for (const track of asArray(getField(view, 'tracks'))) {
      for (const display of asArray(getField(track, 'displays'))) {
        if (
          isRecord(display) &&
          typeof display.configuration === 'string' &&
          openDisplayIds.has(display.configuration)
        ) {
          display.ignorePromotedDefaults = true
        }
      }
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

// A view whose open tracks we can enumerate — narrowed structurally, mirroring
// promotableDefaults' openDisplaysOfType (the generic view interface doesn't
// surface `tracks`).
function hasOpenTracks<T extends object>(
  view: T,
): view is T & {
  tracks: {
    displays: PromotableDisplay[]
  }[]
} {
  return 'tracks' in view && Array.isArray(view.tracks)
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : []
}

function getField(v: unknown, key: string): unknown {
  return isRecord(v) ? v[key] : undefined
}
