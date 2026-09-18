import {
  addDisposer,
  addMiddleware,
  getParent,
  hasParent,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun, untracked } from 'mobx'

import type { LinearGenomeViewModel } from './model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { Theme } from '@mui/material'

/**
 * A detail level is a LinearGenomeView nested under another one, drawn below
 * the host's tracks and showing a narrower window of the same locus — the
 * header overview's relationship to the view, carried on downward. Its only
 * state of its own is `windowWidthBp` and `tracks`: the host writes its
 * regions, width and left edge, so the level always shares the host's centre.
 *
 * Declared by hand rather than as the view model's own instance type: the
 * level array is a `types.late` back onto the registered LinearGenomeView, and
 * naming the model's instance type inside its own factory is a circular
 * reference tsc refuses (TS7022). Components outside the factory cast a level
 * to `LinearGenomeViewModel`.
 */
export interface DetailLevel extends IStateTreeNode {
  id: string
  bpPerPx: number
  minBpPerPx: number
  windowWidthBp: number
  windowStartBp: number
  displayedRegions: Region[]
  pendingLaunch?: unknown
  setWidth(width: number): void
  setDisplayedRegions(regions: Region[]): void
  setWindowFrame(windowWidthBp: number, windowStartBp: number): void
  showTrack(trackId: string): unknown
}

/**
 * The stack in page order, each level paired with the row above it — the
 * previous level, or the host for the first. The array is widest first and
 * every level is narrower than its host, so page order and array order are the
 * same thing and each pair reads as one trapezoid: the span this row shows,
 * marked on the row above it.
 *
 * One derivation for the screen and the SVG export, which otherwise agree on
 * the order by having been written twice.
 */
export function detailStackRows<T>(host: T, levels: T[]) {
  return levels.map((level, i) => ({ level, context: levels[i - 1] ?? host }))
}

export const DETAIL_FRAME_WIDTH = 2

/**
 * The outline a detail level and its connector share. Tertiary is the header
 * overview's colour, but the dark themes set it near black, so those take its
 * light shade.
 */
export function detailLevelColor(theme: {
  palette: Pick<Theme['palette'], 'mode' | 'tertiary'>
}) {
  return theme.palette.mode === 'dark'
    ? theme.palette.tertiary.light
    : theme.palette.tertiary.main
}

/**
 * The registered view, read at first instantiation rather than the factory's
 * own return value, so a level is the LinearGenomeView every `extendViewType`
 * caller has already extended. The name goes through a `string` so the typed
 * `getViewType` overload, whose result names this model's own instance type,
 * is not what tsc resolves here.
 */
export function detailLevelType(pluginManager: PluginManager) {
  const name: string = 'LinearGenomeView'
  return types.late(
    (): IAnyModelType => pluginManager.getViewType(name).stateModel,
  )
}

/**
 * What a level reaches on the view holding it. Not `LinearGenomeViewModel`:
 * the model's own factory calls this, and a return type naming the model there
 * is the same circular reference as above, which tsc resolves by quietly
 * widening the whole model.
 */
export interface DetailLevelHost extends IStateTreeNode {
  bpPerPx: number
  windowWidthBp: number
  detailLevelViews: DetailLevel[]
  removeDetailLevel(level: DetailLevel): void
  horizontalScroll(distance: number): number
  slide(viewWidths: number): void
  scrollToBp(startBp: number): number
}

export function detailLevelHost(
  node: IStateTreeNode,
): DetailLevelHost | undefined {
  const host = hasParent(node, 2)
    ? getParent<Record<string, unknown>>(node, 2)
    : undefined
  return host && 'detailLevels' in host
    ? (host as unknown as DetailLevelHost)
    : undefined
}

// The three sets below classify every navigation-shaped action of the view,
// and `detailLevels.test.ts` holds them against the view's real action list:
// a navigation in none of them lands on the level and quietly walks it off the
// host's centre.

// A gesture on a level that means "move": replayed on the host in the host's
// own units, and swallowed on the level, whose left edge is derived.
export const LEVEL_PANS = new Set(['horizontalScroll', 'scrollTo', 'slide'])

// A navigation on a level that names a place. The level and its host lay out
// the same regions, so the arguments mean the same thing on either, and the
// host is where they belong. `centerAt` is not an action but a method over
// `scrollTo`, so the pan above already lands it.
export const LEVEL_NAVIGATIONS = new Set([
  'moveTo',
  'flyToCenter',
  'navTo',
  'navToLocation',
  'navToMultiple',
  'navToLocString',
  'navToLocations',
  'navigateNewestBookmark',
  'showRegions',
  'showAllRegionsInAssembly',
])

// Everything a level hands to its host untouched. The navigations above, plus
// the picture: what a reader sees is the stack, and `renderToSvg` draws every
// level above the host that owns them, so a level's own Export SVG is the
// host's. A level alone is a row out of a figure nobody asked for.
export const LEVEL_REPLAYS = new Set([...LEVEL_NAVIGATIONS, 'exportSvg'])

// What stays the level's own: its zoom, which is its one piece of state, and
// the primitives the sync writes through. `zoomTo` from a wheel anchors under
// the cursor, and the sync puts the centre back on the same frame.
export const LEVEL_OWN = new Set([
  'zoomTo',
  'zoom',
  'flyTo',
  'showAllRegions',
  'fitAllRegions',
  'clampZoomToCeiling',
  'setWindow',
  'setWindowFrame',
  'setNewView',
  'scrollToBp',
  'setDisplayedRegions',
  'horizontallyFlip',
])

/**
 * Keep every level a derived view of its host: same regions, same width, same
 * centre, and between base level and the row above it, so the stack reads the
 * host's span at the top zooming in the whole way down. A level zoomed out past
 * its ceiling is pulled back in; a host zoomed in past a level pulls the level
 * in with it.
 */
function syncDetailLevels(self: LinearGenomeViewModel) {
  // The stack first and alone, so a view with no levels — which is every view
  // in the session but the one someone built a stack on — depends on this
  // array and nothing else, and its own pans and zooms wake nothing here.
  const levels = self.detailLevelViews
  if (!levels.length) {
    return
  }
  const { volatileWidth, displayedRegions, windowStartBp, windowWidthBp } = self
  if (volatileWidth === undefined || !displayedRegions.length) {
    return
  }
  const centerBp = windowStartBp + windowWidthBp / 2
  let ceiling = windowWidthBp
  for (const level of levels) {
    level.setWidth(volatileWidth)
    if (level.displayedRegions !== displayedRegions) {
      level.setDisplayedRegions(displayedRegions)
    }
    // BOTH of the level's own window numbers are read, not just its width, and
    // that is what makes this the thing holding a level under its host rather
    // than the gesture sets below. An action that moves a level without
    // resizing it — one the sets do not cover, or one added later that nobody
    // classified — otherwise never wakes this autorun, and the level sits off
    // the centre for good with nothing to put it back. Read, it snaps back, so
    // a miss costs that gesture rather than the stack.
    const { windowWidthBp: levelWidth, windowStartBp: levelStart } = level
    // The floor is base level, which `zoomTo` holds every gesture to but not
    // the window a snapshot arrives carrying — and a stack ten times in each
    // step reaches it in three or four rungs.
    const floor = level.minBpPerPx * volatileWidth
    const width = Math.min(Math.max(levelWidth, floor), ceiling)
    const start = centerBp - width / 2
    if (width !== levelWidth || start !== levelStart) {
      level.setWindowFrame(width, start)
    }
    ceiling = level.windowWidthBp
  }
}

/**
 * Replay a gesture made on a level onto its host, or answer false to let it
 * through. Every read here is of the live tree, which is why the caller runs it
 * untracked.
 */
function redirectLevelGesture(
  self: LinearGenomeViewModel,
  host: DetailLevelHost,
  call: { name: string; args: unknown[] },
  abort: (value: unknown) => void,
) {
  // a level's own launch navigates it, and that is not a gesture: the sync
  // above puts it back under the host once the regions land
  if (self.pendingLaunch) {
    return false
  }
  if (LEVEL_PANS.has(call.name)) {
    const arg = call.args[0] as number
    const ratio = self.bpPerPx / host.bpPerPx
    if (call.name === 'horizontalScroll') {
      abort(host.horizontalScroll(arg * ratio) / ratio)
    } else if (call.name === 'slide') {
      // a fraction of the level's window is that many of its bases, which is
      // `ratio` widths of the host
      host.slide(arg * ratio)
      abort(undefined)
    } else {
      const centerBp = arg * self.bpPerPx + self.windowWidthBp / 2
      host.scrollToBp(centerBp - host.windowWidthBp / 2)
      abort(arg)
    }
    return true
  }
  if (LEVEL_REPLAYS.has(call.name)) {
    const target = host as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >
    abort(target[call.name]!(...call.args))
    return true
  }
  return false
}

/**
 * The gesture redirect, installed on the LEVEL rather than on the view holding
 * it. MST collects a call's middleware by walking from the action's own node up
 * to the root, so one installed on the host runs for every action of every
 * track and display beneath it — a tax on views that will never hold a level,
 * which is nearly all of them — where one installed here sees this level's
 * subtree and nothing else. It also makes the identity check an identity check
 * rather than a search through the host's array.
 */
function installLevelGestures(
  self: LinearGenomeViewModel,
  host: DetailLevelHost,
) {
  addDisposer(
    self,
    addMiddleware(self, (call, next, abort) => {
      const mine =
        call.type === 'action' &&
        call.id === call.rootId &&
        call.context === self
      // A middleware handler runs in whatever context dispatched the action,
      // and one of those is `syncDetailLevels` — an autorun that dispatches
      // level actions. A `pendingLaunch` or `bpPerPx` read registered there
      // re-runs the whole sync whenever anything in the stack moves.
      // eslint-disable-next-line no-restricted-syntax -- effect input: the two scales a gesture is replayed at, read where an autorun may be the caller
      const handled = untracked(
        () => mine && redirectLevelGesture(self, host, call, abort),
      )
      if (!handled) {
        next(call)
      }
    }),
  )
}

export function installDetailLevels(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function detailLevelsAutorun() {
        syncDetailLevels(self)
      },
      { name: 'LGVDetailLevels' },
    ),
  )
  const host = detailLevelHost(self)
  if (host) {
    installLevelGestures(self, host)
  }
}
