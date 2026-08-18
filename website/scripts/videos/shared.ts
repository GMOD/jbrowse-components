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
