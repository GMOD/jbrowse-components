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

// A radio row only writes a setting, so every level of its cascade is still
// standing over the lane it changed. One click on the root menu's backdrop takes
// them all (a submenu's own backdrop takes no pointer events, and Escape leaves
// one level per press); `row` is one that has to be gone after it. The second
// click, on the inert wordmark, blurs the menu icon, whose "Track settings"
// tooltip outlives the menu, and parks the pointer clear of the lanes.
export const leaveMenu = (row: string): VideoStep[] => [
  { type: 'click', selector: '.MuiBackdrop-root', hold: 0 },
  { type: 'waitForSelector', selector: row, hidden: true },
  { type: 'click', selector: '[aria-label="JBrowse"]', hold: 0 },
  { type: 'waitForText', text: 'Track settings', hidden: true },
]

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

// File → Open track..., a file URL pasted in, Next, and Add: the route a reader
// takes to open their own file, with no config written. The `add` line goes up
// on Next, so it stands over the confirm step that shows the inferred name and
// adapter; the track draws once the drawer has closed itself.
export function openTrackByUrlSteps(
  url: string,
  { open, add }: { open: string; add: string },
): VideoStep[] {
  return [
    { type: 'click', text: 'File', say: open, hold: 900 },
    { type: 'waitForText', text: 'Open track...' },
    { type: 'click', text: 'Open track...' },
    { type: 'waitForText', text: 'Enter track data' },
    { type: 'delay', ms: 1000 },
    // held long enough to see the second step appear under the field
    {
      type: 'type',
      selector: '[data-testid="urlInput"]',
      value: url,
      hold: 2200,
    },
    {
      type: 'click',
      selector: '[data-testid="addTrackNextButton"]',
      say: add,
      hold: 1800,
    },
    // the same button, now reading Add
    { type: 'click', selector: '[data-testid="addTrackNextButton"]' },
    { type: 'waitForAppSettled', timeout: 120000 },
  ]
}
