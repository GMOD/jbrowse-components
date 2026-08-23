import { isFeature } from '@jbrowse/core/util'
import { autorun, untracked } from 'mobx'

import { getShareableSessionSnapshot } from './Session/shareableSnapshot.ts'

import type { SessionSnapshot } from './sessionUrl.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The JS -> host read-backs of a running embedded product, for a host that
// keeps its state somewhere other than this page: a notebook kernel, an R
// session, a server. MST's own patch stream is the wrong tool for them — it
// fires per pointer event during a drag — so each such host wrote this itself,
// and they got the same two things wrong. Shared here for the same reason as
// toPluginLoadRecord: every embedded controller needs it, and the ways to get
// it wrong stay invisible until a specific combination shows up.

// The root and its views are duck-typed rather than imported. product-core
// cannot name a concrete product's session type without a root<->session cycle
// (see BaseRootModel), and `session.views` is a pluggable MST type, i.e. `any` —
// so a real shape here is what keeps these reads checked at all.
type OpenTracks = { configuration: { trackId: string } }[]

interface ObservedView {
  id?: string
  coarseVisibleLocStrings?: string
  views?: { coarseVisibleLocStrings?: string }[]
  tracks?: OpenTracks
  levels?: { tracks: OpenTracks }[]
}

interface ObservedSession {
  name: string
  views: ObservedView[]
  selection?: unknown
}

// `session` is a `types.maybe` on every root model, so this is the shape a
// controller actually holds
interface ObservedRoot {
  session?: ObservedSession
}

/** where one view is looking: a locstring, or one per panel for a comparative view */
export type ViewLocation = string | string[] | undefined

export interface SessionObservers {
  /** fires with every view's visible region when the layout settles */
  onLocationChange?: (locations: ViewLocation[]) => void
  /** fires with the serialized feature when one is selected in any view */
  onFeatureSelect?: (feature: unknown) => void
  /**
   * fires with a plain-JSON snapshot of the layout the user built, in the shape
   * the `session` option takes — so "save this arrangement" is storing this
   * value and reopening it is passing it back
   */
  onSessionChange?: (session: SessionSnapshot) => void
}

/**
 * The live session as a plain JSON snapshot, ready to hand straight back as a
 * product's `session` option (or its controller's `setSession`). The
 * uncompressed twin of `encodeSession`, for hosts that move JSON rather than
 * URLs — a notebook kernel, an R session, a "save this layout" button.
 *
 * Not a plain `getSnapshot`, and for the same reason `encodeSession` isn't:
 * display settings a user is *inheriting* from a promoted display-type default
 * live in their own browser, never in the session, so a raw snapshot replays
 * differently for whoever opens it.
 */
export function getSessionSnapshot(session: ObservedSession): SessionSnapshot {
  // `name` is restated rather than the whole thing cast: the bake returns an
  // open record, but the model guarantees the session has one
  return {
    ...getShareableSessionSnapshot(session as unknown as AbstractSessionModel),
    name: session.name,
  }
}

// A linear view reports its visible region as one coarseVisibleLocStrings
// string; a comparative view (synteny/dotplot) has no single string, so report
// one entry per panel instead.
function viewLocation(view: ObservedView): ViewLocation {
  return typeof view.coarseVisibleLocStrings === 'string'
    ? view.coarseVisibleLocStrings || undefined
    : view.views
        ?.map(v => v.coarseVisibleLocStrings)
        .filter(loc => loc !== undefined)
}

// Every trackId a view has open. A synteny view keeps its tracks per level
// rather than in one flat list, so reading `tracks` alone reports none of them —
// and the read-back then never fired when a synteny track was opened.
function viewTracks(view: ObservedView) {
  return (view.tracks ?? view.levels?.flatMap(l => l.tracks) ?? [])
    .map(t => t.configuration.trackId)
    .join(',')
}

// The coarse signal the read-backs ride on: which views exist, what each has
// open, and where each is looking. Deliberately NOT the whole snapshot —
// depending on that would pull in offsetPx, and a snapshot is kilobytes, so a
// drag would push one per pointer event across the host's wire.
// coarseVisibleLocStrings is JBrowse's own debounced location, so this settles
// after a pan rather than firing during it.
//
// A plain function, not an action: actions run untracked, and computing this is
// precisely what subscribes the autorun below.
function layoutSignal(views: ObservedView[]) {
  return views
    .map(v => `${v.id}:${JSON.stringify(viewLocation(v))}:${viewTracks(v)}`)
    .join('|')
}

/**
 * Wire the read-backs a host asked for, returning one disposer for all of them.
 */
export function observeSession(
  root: ObservedRoot,
  { onLocationChange, onFeatureSelect, onSessionChange }: SessionObservers,
) {
  const disposers: (() => void)[] = []

  // `session` is read inside each autorun and never captured: setSession
  // replaces the whole node (`self.session = cast(...)` in BaseRootModel), so a
  // captured one is a dead MST node the moment a session is restored, and the
  // read-back would go silent for the rest of the product's life.
  if (onLocationChange ?? onSessionChange) {
    disposers.push(
      autorun(() => {
        const { session } = root
        if (!session) {
          return
        }
        // the only dependency this autorun should have
        layoutSignal(session.views)
        onLocationChange?.(session.views.map(viewLocation))
        // untracked, so reading the snapshot adds no dependencies of its own
        // eslint-disable-next-line no-restricted-syntax -- effect input: the callback consumes the snapshot, the views are the trigger
        onSessionChange?.(untracked(() => getSessionSnapshot(session)))
      }),
    )
  }

  if (onFeatureSelect) {
    disposers.push(
      autorun(() => {
        const selection = root.session?.selection
        if (isFeature(selection)) {
          onFeatureSelect(selection.toJSON())
        }
      }),
    )
  }

  return () => {
    for (const dispose of disposers) {
      dispose()
    }
  }
}
