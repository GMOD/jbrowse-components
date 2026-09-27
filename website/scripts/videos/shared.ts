import type { VideoStep } from '../video-spec-types.ts'

// The selectors more than one tour drives. Same rule as
// screenshot-spec-helpers.ts: nothing with a single consumer belongs here — it
// goes next to the tour that uses it, and moves here when a second one turns up.

// The dendrogram exists only once the clustering RPC has returned, so it is both
// the gate a clustering tour waits on and the visible half of what the route
// produced. Every clustering tour drives it.
export const DENDROGRAM = '[data-testid="tree_sidebar_dendrogram"]'

// The linear view's location box, which is how a tour navigates the way a reader
// would rather than by reloading a session at the next locus.
export const LOCATION_BOX = 'input[placeholder="Search for location"]'

// The scalebar strip a rubberband is drawn on. Naming it as a `band` puts the
// drag's y here while its x still comes from the locus, so the tour says which
// bases it selects instead of which pixels.
export const RUBBERBAND = '[data-testid="rubberband_controls"]'

// A selection on the scale bar and Zoom to region, for a tour narrowing a
// linear view on a span no gene name reaches: the viewer watches the span being
// chosen, where a typed coordinate is a run of digits. It also undoes a drawer,
// since an LGV keeps its bp-per-pixel while a widget takes ~400 px off it.
export function zoomToSteps(window: string, say?: string): VideoStep[] {
  const [ref, range] = window.split(':')
  const [start, end] = range!.split('-')
  return [
    {
      type: 'drag',
      fromAnchor: { locus: `${ref}:${start}`, band: RUBBERBAND },
      toAnchor: { locus: `${ref}:${end}`, band: RUBBERBAND },
      ...(say ? { say } : {}),
      hold: 900,
    },
    { type: 'waitForText', text: 'Zoom to region' },
    { type: 'click', text: 'Zoom to region' },
    { type: 'waitForText', text: 'Zoom to region', hidden: true },
  ]
}

// The track menu button for one track, which is where most routes start.
export const trackMenu = (trackId: string) =>
  `[data-testid="track_menu_icon"][data-trackid="${trackId}"]`

// A display by its own id rather than by type: `feature-display` is the testid
// every canvas feature lane shares, so a lane already standing would satisfy it
// and a tour would carry on before the track it just added had fetched anything.
// `<trackId>-<displayType>` is what a config with no explicit `displayId` gets
// (packages/core/src/util/tracks.ts).
export const displayReady = (displayId: string) =>
  `[data-display-id="${displayId}"][data-display-phase="ready"]`

// A cascade row by its own testid rather than by its text. `CascadingMenu` slugs
// each label into `cascading-<kind>-<label>`, so a label that also appears on a
// section chip or twice in one cascade still names one row.
export const cascade = (kind: 'submenu' | 'menuitem', label: string) =>
  `[data-testid="cascading-${kind}-${label.toLowerCase().replaceAll(/\s+/g, '_')}"]`

// A graph segments lane redrawn as the graph: the track menu's Display types
// submenu, and the row the graph plugin's LinearGraphDisplay is listed by.
export const DISPLAY_TYPES = cascade('submenu', 'Display types')
export const GRAPH_DISPLAY = cascade('menuitem', 'Graph')
