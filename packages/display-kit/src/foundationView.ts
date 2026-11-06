import {
  getContainingTrack,
  getContainingView,
  getSession,
} from '@jbrowse/core/util/mstUtils'
import {
  getConfAssemblyNamesOrNone,
  isSameAssemblyName,
} from '@jbrowse/core/util/tracks'

import type { RegionHost } from './regionHost.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The `RegionHost` a display reads regions, viewport and scale from: the
 * view's `regionHost` where it publishes one (the circular view's strip),
 * else the view. A display needing the linear genome view itself declares
 * its own `view` getter.
 */
export function containingHost(self: IStateTreeNode): RegionHost {
  const view = getContainingView(self)
  return (view.regionHost ?? view) as RegionHost
}

/**
 * The CSS width of a display's on-screen canvas, in px, which its
 * `renderState.canvasWidth` must match. `trackWidthPx`, not `view.width`: the
 * container insets the canvas by the 2px track outline, and a wider canvas is
 * clipped almost invisibly. Lint bans the underlying read outside this file.
 * SVG export overrides it with the shell's width (`LgvSvgBodyProps`).
 */
export function trackCanvasWidthPx(host: Pick<RegionHost, 'trackWidthPx'>) {
  return host.trackWidthPx
}

/**
 * Whether a block on `assemblyName` is on one of the containing track's
 * genomes. A view can show genomes the track lacks and keeps their blocks for
 * drawing, so a site fetching from a host list filters it through this. A track
 * naming no genome admits every block.
 */
export function onTrackAssembly(self: IStateTreeNode) {
  const names = getConfAssemblyNamesOrNone(
    getContainingTrack(self).configuration,
  )
  const { assemblyManager } = getSession(self)
  return (assemblyName: string) =>
    names.length === 0 ||
    names.some(name => isSameAssemblyName(name, assemblyName, assemblyManager))
}

/**
 * `RenderLifecycleMixin`'s `canRender` for every LGV display: wait until the
 * view is measured, since view geometry throws before then and the render
 * autorun would show that as a render-error banner.
 */
export function foundationCanRender(self: { host: { initialized: boolean } }) {
  return self.host.initialized
}
