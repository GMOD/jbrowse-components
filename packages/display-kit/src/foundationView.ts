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
 * The view that hosts a display, typed once for every display in both
 * foundations as the `RegionHost` contract, so no consumer repeats the cast
 * `getContainingView` needs (it is view-type-agnostic) but which a foundation
 * has already committed to.
 *
 * `host` rather than `view`, because the two are different things: `host` is
 * the contract this layer reads (regions, viewport, scale), and a display that
 * needs the linear genome view itself (`pxToBp`, `showTrack`, its chrome
 * settings) declares its own `view` getter typed as that model. Naming the
 * contract after the view it happens to be satisfied by is how the display
 * layer came to depend on the view plugin.
 *
 * A view whose displays lay out along an axis that is not its box publishes
 * that axis as `regionHost` — the circular view's strip, the circumference a
 * ring unrolls to — and this answers it before the view itself. Every
 * structural helper in this package resolves the host here for that reason;
 * `getContainingView` alone hands back the view.
 */
export function containingHost(self: IStateTreeNode): RegionHost {
  const view = getContainingView(self)
  return (view.regionHost ?? view) as RegionHost
}

/**
 * The CSS width of a display's on-screen canvas, in px, and the `canvasWidth`
 * its `renderState` must hold, since the two have to agree or the bp→px
 * mapping is scaled against a box it doesn't fill. Both foundations answer
 * `canvasWidthPx` with it.
 *
 * `trackWidthPx`, **not** `view.width`: `TrackRenderingContainer` insets the
 * rendering component by the 2px track outline under `contain: strict`, so a
 * `view.width`-wide canvas overhangs the container and the browser clips the
 * overhang away. It renders almost identically, which is why MAF and then
 * multi-way synteny used `view.width` unnoticed.
 *
 * One function, because the choice was being made by copying a neighbour out
 * of four plausible view getters — `width` (the viewport), this one, and
 * `totalWidthPx` / `totalWidthPxWithoutBorders` (the *content* width, which the
 * global family's heatmaps legitimately want: a different question, not a
 * different answer). `no-restricted-syntax` bans the underlying read
 * everywhere but this file.
 *
 * SVG export is the one exception: the export shell has no outline, so
 * `renderSvg` overrides `canvasWidth` with the shell's own width (see
 * `LgvSvgBodyProps`).
 */
export function trackCanvasWidthPx(host: RegionHost) {
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
 * The render-lifecycle precondition for every LGV display, overriding
 * `RenderLifecycleMixin`'s default-true hook: don't run the upload/render
 * callbacks until the view is measured. Before that, a display's `renderState`
 * is sized off view geometry (`renderBlocks` → `visibleRegions` → `view.width`,
 * or a global display's `totalWidthPx` / `dynamicBlocks`) which throws by
 * design, and the render autorun's catch would show that as a GPU render-error
 * banner.
 *
 * With the gate applied once for every LGV display, a display's `renderState`
 * can be a plain resolved getter and its render callback can gate only on its
 * data. `foundationCanRender` is the render-lifecycle twin of
 * `autorunOnReadyView`.
 */
export function foundationCanRender(self: { host: { initialized: boolean } }) {
  return self.host.initialized
}
