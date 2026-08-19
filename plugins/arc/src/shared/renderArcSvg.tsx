import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LgvSvgBodyProps } from '@jbrowse/plugin-linear-genome-view'

// Bezier-arc-overlay exception (see agent-docs/reference/SVG_EXPORT.md): arc
// paths render as vector SVG on both the on-screen and export paths so
// hover/tooltips work natively, so the body returns <Arcs> JSX directly rather
// than routing through paintLayer. That is the *only* way arc differs, so it
// goes through `renderDisplaySvg` like every other LGV display and inherits the
// readiness wait, the export geometry and the terminal-state gate from it.
//
// Both arc displays export through here — the only difference between them is
// which <Arcs> paints, so they pass it in, which is why the body is built here
// rather than being a module-level component.
//
// Passes no ExportSvgDisplayOptions: with no paintLayer there is no
// rasterizeLayers/createCanvas to honor, and the theme arrives through the
// export root's ThemeProvider. The displays' renderSvg actions still accept
// opts because the export framework calls them with it.
export async function renderArcSvg<M extends ArcDisplayModel>(
  model: M,
  Arcs: (props: { model: M; exportSVG?: boolean }) => React.ReactNode,
) {
  return renderDisplaySvg(
    model,
    undefined,
    function ArcsSvgBody(props: LgvSvgBodyProps<M>) {
      // the display's own `canvasWidth`, not the shell's viewport-width prop of
      // the same name: arcs are laid out across the whole scrolled content and a
      // bezier legitimately bows outside the viewport on its way between two
      // endpoints inside it
      return (
        <SvgClipRect
          id={`arc-${svgNodeId(props.model)}`}
          width={props.model.canvasWidth}
          height={props.height}
        >
          <Arcs model={props.model} exportSVG />
        </SvgClipRect>
      )
    },
  )
}
