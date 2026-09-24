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
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { Region } from '@jbrowse/core/util/types'
import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A close-up is a LinearGenomeView nested under another one, drawn below the
 * host's tracks and showing a narrower window of the same locus — the header
 * overview's relationship to the view, carried on downward. Its only state of
 * its own is `windowWidthBp` and `tracks`: the host writes its regions, width
 * and left edge, so the close-up always shares the host's centre.
 *
 * Declared by hand rather than as the view model's own instance type: the
 * close-up array is a `types.late` back onto the registered LinearGenomeView,
 * and naming the model's instance type inside its own factory is a circular
 * reference tsc refuses (TS7022). Components outside the factory cast a
 * close-up to `LinearGenomeViewModel`.
 */
export interface CloseUp extends IStateTreeNode {
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
 * The stack in page order, each close-up paired with the row above it — the
 * previous close-up, or the host for the first. The array is widest first and
 * every close-up is narrower than its host, so page order and array order are
 * the same thing and each pair reads as one trapezoid: the span this row shows,
 * marked on the row above it.
 *
 * One derivation for the screen and the SVG export, which otherwise agree on
 * the order by having been written twice.
 */
export function closeUpStackRows<T>(host: T, closeUps: T[]) {
  return closeUps.map((closeUp, i) => ({
    closeUp,
    context: closeUps[i - 1] ?? host,
  }))
}

export const CLOSE_UP_FRAME_WIDTH = 1

/**
 * The outline a close-up and its connector share. Tertiary is the header
 * overview's colour, but the dark themes set it near black, so those take its
 * light shade.
 */
export function closeUpColor(
  palette: Pick<JBrowsePalette, 'mode' | 'tertiary'>,
) {
  return palette.mode === 'dark'
    ? palette.tertiary.light
    : palette.tertiary.main
}

/**
 * The registered view, read at first instantiation rather than the factory's
 * own return value, so a close-up is the LinearGenomeView every
 * `extendViewType` caller has already extended. The name goes through a
 * `string` so the typed `getViewType` overload, whose result names this model's
 * own instance type, is not what tsc resolves here.
 */
export function closeUpType(pluginManager: PluginManager) {
  const name: string = 'LinearGenomeView'
  return types.late(
    (): IAnyModelType => pluginManager.getViewType(name).stateModel,
  )
}

/**
 * What a close-up reaches on the view holding it. Not `LinearGenomeViewModel`:
 * the model's own factory calls this, and a return type naming the model there
 * is the same circular reference as above, which tsc resolves by quietly
 * widening the whole model.
 */
export interface CloseUpHost extends IStateTreeNode {
  bpPerPx: number
  windowWidthBp: number
  closeUpViews: CloseUp[]
  removeCloseUp(closeUp: CloseUp): void
  horizontalScroll(distance: number): number
  slide(viewWidths: number): void
  scrollToBp(startBp: number): number
}

export function closeUpHost(node: IStateTreeNode): CloseUpHost | undefined {
  const host = hasParent(node, 2)
    ? getParent<Record<string, unknown>>(node, 2)
    : undefined
  return host && 'closeUps' in host
    ? (host as unknown as CloseUpHost)
    : undefined
}

// The three sets below classify every navigation-shaped action of the view, and
// `closeUps.test.ts` holds them against the view's real action list: a
// navigation in none of them lands on the close-up and quietly walks it off the
// host's centre.

// A gesture on a close-up that means "move": replayed on the host in the host's
// own units, and swallowed on the close-up, whose left edge is derived.
export const CLOSE_UP_PANS = new Set(['horizontalScroll', 'scrollTo', 'slide'])

// A navigation on a close-up that names a place. The close-up and its host lay
// out the same regions, so the arguments mean the same thing on either, and the
// host is where they belong. `centerAt` is not an action but a method over
// `scrollTo`, so the pan above already lands it.
export const CLOSE_UP_NAVIGATIONS = new Set([
  'moveTo',
  'flyToCenter',
  'navTo',
  'navToLocation',
  'navToMultiple',
  'navToLocString',
  'navToLocations',
  'navigateNewestHighlight',
  'showRegions',
  'showAllRegionsInAssembly',
])

// Everything a close-up hands to its host untouched. The navigations above,
// plus the picture: what a reader sees is the stack, and `renderToSvg` draws
// every close-up above the host that owns them, so a close-up's own Export SVG
// is the host's. A close-up alone is a row out of a figure nobody asked for.
export const CLOSE_UP_REPLAYS = new Set([...CLOSE_UP_NAVIGATIONS, 'exportSvg'])

// What stays the close-up's own: its zoom, which is its one piece of state, and
// the primitives the sync writes through. `zoomTo` from a wheel anchors under
// the cursor, and the sync puts the centre back on the same frame.
export const CLOSE_UP_OWN = new Set([
  'zoomTo',
  'zoom',
  'flyTo',
  'flyToFit',
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
 * Keep every close-up a derived view of its host: same regions, same width,
 * same centre, and between base level and the row above it, so the stack reads
 * the host's span at the top zooming in the whole way down. A close-up zoomed
 * out past its ceiling is pulled back in; a host zoomed in past a close-up
 * pulls the close-up in with it.
 */
function syncCloseUps(self: LinearGenomeViewModel) {
  // The stack first and alone, so a view with no close-ups — which is every
  // view in the session but the one someone built a stack on — depends on this
  // array and nothing else, and its own pans and zooms wake nothing here.
  const closeUps = self.closeUpViews
  if (!closeUps.length) {
    return
  }
  const { volatileWidth, displayedRegions, windowStartBp, windowWidthBp } = self
  if (volatileWidth === undefined || !displayedRegions.length) {
    return
  }
  const centerBp = windowStartBp + windowWidthBp / 2
  let ceiling = windowWidthBp
  for (const closeUp of closeUps) {
    closeUp.setWidth(volatileWidth)
    if (closeUp.displayedRegions !== displayedRegions) {
      closeUp.setDisplayedRegions(displayedRegions)
    }
    // BOTH of the close-up's own window numbers are read, not just its width,
    // and that is what makes this the thing holding a close-up under its host
    // rather than the gesture sets below. An action that moves a close-up
    // without resizing it — one the sets do not cover, or one added later that
    // nobody classified — otherwise never wakes this autorun, and the close-up
    // sits off the centre for good with nothing to put it back. Read, it snaps
    // back, so a miss costs that gesture rather than the stack.
    const { windowWidthBp: closeUpWidth, windowStartBp: closeUpStart } = closeUp
    // The floor is base level, which `zoomTo` holds every gesture to but not
    // the window a snapshot arrives carrying — and a stack ten times in each
    // step reaches it in three or four rungs.
    const floor = closeUp.minBpPerPx * volatileWidth
    const width = Math.min(Math.max(closeUpWidth, floor), ceiling)
    const start = centerBp - width / 2
    if (width !== closeUpWidth || start !== closeUpStart) {
      closeUp.setWindowFrame(width, start)
    }
    ceiling = closeUp.windowWidthBp
  }
}

/**
 * Replay a gesture made on a close-up onto its host, or answer false to let it
 * through. Every read here is of the live tree, which is why the caller runs it
 * untracked.
 */
function redirectCloseUpGesture(
  self: LinearGenomeViewModel,
  host: CloseUpHost,
  call: { name: string; args: unknown[] },
  abort: (value: unknown) => void,
) {
  // a close-up's own launch navigates it, and that is not a gesture: the sync
  // above puts it back under the host once the regions land
  if (self.pendingLaunch) {
    return false
  }
  if (CLOSE_UP_PANS.has(call.name)) {
    const arg = call.args[0] as number
    const ratio = self.bpPerPx / host.bpPerPx
    if (call.name === 'horizontalScroll') {
      abort(host.horizontalScroll(arg * ratio) / ratio)
    } else if (call.name === 'slide') {
      // a fraction of the close-up's window is that many of its bases, which is
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
  if (CLOSE_UP_REPLAYS.has(call.name)) {
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
 * The gesture redirect, installed on the CLOSE-UP rather than on the view
 * holding it. MST collects a call's middleware by walking from the action's own
 * node up to the root, so one installed on the host runs for every action of
 * every track and display beneath it — a tax on views that will never hold a
 * close-up, which is nearly all of them — where one installed here sees this
 * close-up's subtree and nothing else. It also makes the identity check an
 * identity check rather than a search through the host's array.
 */
function installCloseUpGestures(
  self: LinearGenomeViewModel,
  host: CloseUpHost,
) {
  addDisposer(
    self,
    addMiddleware(self, (call, next, abort) => {
      const mine =
        call.type === 'action' &&
        call.id === call.rootId &&
        call.context === self
      // A middleware handler runs in whatever context dispatched the action,
      // and one of those is `syncCloseUps` — an autorun that dispatches
      // close-up actions. A `pendingLaunch` or `bpPerPx` read registered there
      // re-runs the whole sync whenever anything in the stack moves.
      // eslint-disable-next-line no-restricted-syntax -- effect input: the two scales a gesture is replayed at, read where an autorun may be the caller
      const handled = untracked(
        () => mine && redirectCloseUpGesture(self, host, call, abort),
      )
      if (!handled) {
        next(call)
      }
    }),
  )
}

export function installCloseUps(self: LinearGenomeViewModel) {
  addDisposer(
    self,
    autorun(
      function closeUpsAutorun() {
        syncCloseUps(self)
      },
      { name: 'LGVCloseUps' },
    ),
  )
  const host = closeUpHost(self)
  if (host) {
    installCloseUpGestures(self, host)
  }
}
