import { getContainingView } from '@jbrowse/core/util'
import {
  SvgChrome,
  SvgClipRect,
  awaitSvgReady,
} from '@jbrowse/plugin-linear-genome-view'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

// Bezier-arc-overlay exception (see agent-docs/reference/SVG_EXPORT.md): arc
// paths render as vector SVG on both the on-screen and export paths so
// hover/tooltips work natively, so the body returns <Arcs> JSX directly rather
// than routing through paintLayer. SvgChrome still owns the SVGErrorBox terminal
// and SvgClipRect the clip wrapper, so arc shares the same contract as every
// other LGV track display; the svgReady gate stays an explicit await at the top.
//
// Both arc displays export through here — the only difference between them is
// which <Arcs> paints, so they pass it in.
export async function renderArcSvg<M extends ArcDisplayModel>(
  model: M,
  Arcs: (props: { model: M; exportSVG?: boolean }) => React.ReactNode,
  opts?: ExportSvgDisplayOptions,
) {
  await awaitSvgReady(model)
  const view = getContainingView(model) as LinearGenomeViewModel
  const height = opts?.overrideHeight ?? model.height
  return (
    <SvgChrome
      error={model.error}
      regionTooLarge={model.regionTooLarge}
      width={view.width}
      height={height}
    >
      <SvgClipRect
        id={`arc-${model.id}`}
        width={view.totalWidthPx}
        height={height}
      >
        <Arcs model={model} exportSVG />
      </SvgClipRect>
    </SvgChrome>
  )
}
