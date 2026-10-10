import { autorun } from 'mobx'

// What a usage report says about a session: the kinds of view, track and
// drawer widget in it, never a name, a location or a file. A view's `tracks`
// are the ones shown in it, as opposed to the config's full track list. A
// plugin view can use the name for something else: an MsaView's `tracks` are
// its own row annotations, with no type, and counting them threw inside the
// analytics ping of every session that opened one.
export interface ActivitySession {
  sessionTracks: { type: string }[]
  views: { type: string; tracks?: readonly object[] }[]
  widgets?: { values(): Iterable<{ type: string }> }
}

export interface SessionShape {
  viewTypes: string[]
  trackTypes: string[]
  widgetTypes: string[]
}

export function describeSession(session: ActivitySession | undefined) {
  const shape: SessionShape = { viewTypes: [], trackTypes: [], widgetTypes: [] }
  if (session) {
    for (const view of session.views) {
      shape.viewTypes.push(view.type)
      for (const track of view.tracks ?? []) {
        if ('type' in track && typeof track.type === 'string') {
          shape.trackTypes.push(track.type)
        }
      }
    }
    for (const widget of session.widgets?.values() ?? []) {
      shape.widgetTypes.push(widget.type)
    }
  }
  return shape
}

// `LinearGenomeView:2,DotplotView:1`, sorted so equal sessions give equal text
export function tallyTypes(types: string[]) {
  const counts = new Map<string, number>()
  for (const type of types) {
    counts.set(type, (counts.get(type) ?? 0) + 1)
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}:${count}`)
    .join(',')
}

// Accumulates what a page load's sessions held at any point, so the end report
// can say what was opened during use and not only what is open at the end.
export function createSessionActivity() {
  const seen = {
    viewTypes: new Set<string>(),
    trackTypes: new Set<string>(),
    widgetTypes: new Set<string>(),
  }
  let maxOpenViews = 0
  let maxOpenTracks = 0
  let current: SessionShape = describeSession(undefined)
  let stopWatching: (() => void) | undefined

  function record(shape: SessionShape) {
    current = shape
    maxOpenViews = Math.max(maxOpenViews, shape.viewTypes.length)
    maxOpenTracks = Math.max(maxOpenTracks, shape.trackTypes.length)
    for (const key of ['viewTypes', 'trackTypes', 'widgetTypes'] as const) {
      for (const type of shape[key]) {
        seen[key].add(type)
      }
    }
  }

  return {
    // jbrowse-web rebuilds the root model when plugins change and Desktop
    // builds one per session opened, so each call replaces the previous watch.
    // A root model that has left its state tree throws when read; the watch
    // then keeps what it last saw.
    watch(getSession: () => ActivitySession | undefined) {
      stopWatching?.()
      stopWatching = autorun(() => {
        try {
          record(describeSession(getSession()))
        } catch {
          // dead state tree
        }
      })
    },
    stop() {
      stopWatching?.()
      stopWatching = undefined
    },
    get watching() {
      return stopWatching !== undefined
    },
    stats() {
      const list = (types: Set<string>) => [...types].sort().join(',')
      return {
        'view-types': tallyTypes(current.viewTypes),
        'open-track-types': tallyTypes(current.trackTypes),
        'seen-view-types': list(seen.viewTypes),
        'seen-track-types': list(seen.trackTypes),
        'seen-widget-types': list(seen.widgetTypes),
        'max-open-views': maxOpenViews,
        'max-open-tracks': maxOpenTracks,
      }
    },
  }
}

export type SessionActivity = ReturnType<typeof createSessionActivity>
