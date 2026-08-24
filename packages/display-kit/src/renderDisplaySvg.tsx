import { SvgChrome } from '@jbrowse/core/svg/SvgExport'
import { awaitSvgReady } from '@jbrowse/core/svg/svgReady'
import { getContainingView } from '@jbrowse/core/util'
import { buildRenderBlocks } from '@jbrowse/render-core/renderBlock'

import type { RegionHost } from './regionHost.ts'
import type { ExportSvgDisplayOptions } from './types.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type React from 'react'

/**
 * The minimum a display must expose to be exported through {@link
 * renderDisplaySvg}: the terminal-state trio from `SvgExportable` plus the
 * height its box occupies.
 */
export interface LgvSvgExportable extends SvgExportable {
  height: number
}

/**
 * What the shell resolves for the body. `canvasWidth` is the load-bearing one:
 * see {@link renderDisplaySvg}.
 */
export interface LgvSvgBodyProps<M> {
  model: M
  view: RegionHost
  height: number
  /**
   * The width the export paints at — `view.width`, deliberately NOT the
   * `view.trackWidthPx` a display's on-screen `renderState` carries.
   * `trackWidthPx` subtracts the 2px track outline, which the export doesn't
   * draw, and it is also the block scissor bound handed to `forEachClippedBlock`
   * — so painting an export at it clips the rightmost 2px column of content
   * inside a `view.width`-wide frame. `LinearMultiRowFeatureDisplay` shipped
   * exactly that bug. A body that reuses `model.renderState` must override
   * `canvasWidth` with this value.
   */
  canvasWidth: number
  /**
   * The view's visible regions as render blocks. Resolved here because every
   * body wanted the identical `buildRenderBlocks(view.visibleRegions)` and each
   * wrote its own — the same reason `canvasWidth` is resolved here rather than
   * re-derived per display.
   */
  renderBlocks: RenderBlock[]
  opts: ExportSvgDisplayOptions | undefined
}

/**
 * The async shell every LGV display's `renderSvg` opens with: await readiness,
 * resolve the view geometry once, and mount the single terminal-state gate
 * around the display's own body.
 *
 * A display that failed to load fails the whole export, in `awaitSvgReady`
 * itself. `regionTooLarge` is the other terminal and stays drawn: see
 * `SvgChrome` for why the two are not symmetric.
 *
 * `Body` is a **component**, not a callback, and that is load-bearing:
 * `SvgChrome` renders `SVGMessageBox` *instead of* its children in a terminal
 * state, so a body expressed as a component never runs there and no `renderSvg`
 * has to re-detect a terminal from empty or absent data. The contract is
 * documented in `agent-docs/reference/SVG_EXPORT.md`; this function is where it
 * is enforced rather than restated per display.
 *
 * ```tsx
 * export async function renderSvg(model: RenderSvgModel, opts?: ExportSvgDisplayOptions) {
 *   return renderDisplaySvg(model, opts, XxxSvgBody)
 * }
 *
 * function XxxSvgBody({ model, view, height, canvasWidth, opts }: LgvSvgBodyProps<RenderSvgModel>) {
 *   ...
 * }
 * ```
 */
export async function renderDisplaySvg<M extends LgvSvgExportable>(
  model: M,
  opts: ExportSvgDisplayOptions | undefined,
  Body: React.ComponentType<LgvSvgBodyProps<M>>,
): Promise<React.ReactNode> {
  await awaitSvgReady(model)
  const view = getContainingView(model) as RegionHost
  const height = model.height
  return (
    <SvgChrome
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <Body
        model={model}
        view={view}
        height={height}
        canvasWidth={view.width}
        renderBlocks={buildRenderBlocks(view.visibleRegions)}
        opts={opts}
      />
    </SvgChrome>
  )
}
