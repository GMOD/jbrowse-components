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

/**
 * A context level is a LinearGenomeView nested under another one, showing a
 * wider window of the same locus over the host's tracks, or under them when
 * the host says so. Its only state of its own is `windowWidthBp` and `tracks`:
 * the host writes its regions, width and left edge, so the level always shares
 * the host's centre.
 *
 * Declared by hand rather than as the view model's own instance type: the
 * level array is a `types.late` back onto the registered LinearGenomeView, and
 * naming the model's instance type inside its own factory is a circular
 * reference tsc refuses (TS7022). Components outside the factory cast a level
 * to `LinearGenomeViewModel`.
 */
export interface ContextLevel extends IStateTreeNode {
  id: string
  bpPerPx: number
  maxBpPerPx: number
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
 * The stack in page order, each level paired with the row its trapezoid points
 * at — the level below it in the stack, or the host itself. Above the tracks
 * the widest level comes first and the pairs read down to the host; below, the
 * host is the row above the first pair and the stack reads outward from it.
 *
 * One derivation for the screen and the SVG export, which otherwise agree on
 * the order by having been written twice.
 */
export function contextStackRows<T>(host: T, levels: T[], below: boolean) {
  const rows = levels.map((level, i) => ({
    level,
    detail: levels[i + 1] ?? host,
  }))
  return below ? rows.reverse() : rows
}

/**
 * The registered view, read at first instantiation rather than the factory's
 * own return value, so a level is the LinearGenomeView every `extendViewType`
 * caller has already extended. The name goes through a `string` so the typed
 * `getViewType` overload, whose result names this model's own instance type,
 * is not what tsc resolves here.
 */
export function contextLevelType(pluginManager: PluginManager) {
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
export interface ContextLevelHost extends IStateTreeNode {
  bpPerPx: number
  windowWidthBp: number
  contextLevelViews: ContextLevel[]
  removeContextLevel(level: ContextLevel): void
  horizontalScroll(distance: number): number
  slide(viewWidths: number): void
  scrollToBp(startBp: number): number
}

export function contextLevelHost(
  node: IStateTreeNode,
): ContextLevelHost | undefined {
  const host = hasParent(node, 2)
    ? getParent<Record<string, unknown>>(node, 2)
    : undefined
  return host && 'contextLevels' in host
    ? (host as unknown as ContextLevelHost)
    : undefined
}

// The three sets below classify every navigation-shaped action of the view,
// and `contextLevels.test.ts` holds them against the view's real action list:
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
 * centre, and never narrower than the level below it, so the stack reads
 * widest at the top down to the host. A level zoomed in past its floor is
 * pushed back out; a host zoomed out past a level pushes the level out with
 * it.
 */
function syncContextLevels(self: LinearGenomeViewModel) {
  // The stack first and alone, so a view with no levels — which is every view
  // in the session but the one someone built a stack on — depends on this
  // array and nothing else, and its own pans and zooms wake nothing here.
  const levels = self.contextLevelViews
  if (!levels.length) {
    return
  }
  const { volatileWidth, displayedRegions, windowStartBp, windowWidthBp } = self
  if (volatileWidth === undefined || !displayedRegions.length) {
    return
  }
  const centerBp = windowStartBp + windowWidthBp / 2
  let floor = windowWidthBp
  for (const level of [...levels].reverse()) {
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
    const width = Math.max(levelWidth, floor)
    const start = centerBp - width / 2
    if (width !== levelWidth || start !== levelStart) {
      level.setWindowFrame(width, start)
    }
    floor = level.windowWidthBp
  }
}

/**
 * Replay a gesture made on a level onto its host, or answer false to let it
 * through. Every read here is of the live tree, which is why the caller runs it
 * untracked.
 */
function redirectLevelGesture(
  self: LinearGenomeViewModel,
  host: ContextLevelHost,
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
  host: ContextLevelHost,
) {
  addDisposer(
    self,
    addMiddleware(self, (call, next, abort) => {
      const mine =
        call.type === 'action' &&
        call.id === call.rootId &&
        call.context === self
      // A middleware handler runs in whatever context dispatched the action,
      // and one of those is `syncContextLevels` — an autorun that dispatches
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

export function installContextLevels(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function contextLevelsAutorun() {
        syncContextLevels(self)
      },
      { name: 'LGVContextLevels' },
    ),
  )
  const host = contextLevelHost(self)
  if (host) {
    installLevelGestures(self, host)
  }
}
