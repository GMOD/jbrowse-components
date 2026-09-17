import {
  addDisposer,
  addMiddleware,
  getParent,
  hasParent,
  types,
} from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from './model.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { Region } from '@jbrowse/core/util/types'
import type { IAnyModelType, IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * A context level is a LinearGenomeView nested under another one, showing a
 * wider window of the same locus above the host's tracks. Its only state of
 * its own is `windowWidthBp` and `tracks`: the host writes its regions, width
 * and left edge, so the level always shares the host's centre.
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
  contextLevelViews: ContextLevel[]
  removeContextLevel(level: ContextLevel): void
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
  const { volatileWidth, displayedRegions, windowStartBp, windowWidthBp } = self
  const levels = self.contextLevelViews
  if (
    volatileWidth === undefined ||
    !displayedRegions.length ||
    !levels.length
  ) {
    return
  }
  const centerBp = windowStartBp + windowWidthBp / 2
  let floor = windowWidthBp
  for (const level of [...levels].reverse()) {
    level.setWidth(volatileWidth)
    if (level.displayedRegions !== displayedRegions) {
      level.setDisplayedRegions(displayedRegions)
    }
    const width = Math.max(level.windowWidthBp, floor)
    level.setWindowFrame(width, centerBp - width / 2)
    floor = level.windowWidthBp
  }
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
  addDisposer(
    self,
    addMiddleware(self, (call, next, abort) => {
      const level =
        call.type === 'action' && call.id === call.rootId
          ? self.contextLevelViews.find(l => l === call.context)
          : undefined
      // a level's own launch navigates it, and that is not a gesture: the
      // sync above puts it back under the host once the regions land
      if (!level || level.pendingLaunch) {
        next(call)
      } else if (LEVEL_PANS.has(call.name)) {
        const arg = call.args[0] as number
        const ratio = level.bpPerPx / self.bpPerPx
        if (call.name === 'horizontalScroll') {
          abort(self.horizontalScroll(arg * ratio) / ratio)
        } else if (call.name === 'slide') {
          // a fraction of the level's window is that many of its bases, which
          // is `ratio` widths of the host
          self.slide(arg * ratio)
          abort(undefined)
        } else {
          const centerBp = arg * level.bpPerPx + level.windowWidthBp / 2
          self.scrollToBp(centerBp - self.windowWidthBp / 2)
          abort(arg)
        }
      } else if (LEVEL_REPLAYS.has(call.name)) {
        const host = self as unknown as Record<
          string,
          (...args: unknown[]) => unknown
        >
        abort(host[call.name]!(...call.args))
      } else {
        next(call)
      }
    }),
  )
}
