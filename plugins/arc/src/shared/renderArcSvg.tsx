import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { renderDisplaySvg } from '@jbrowse/display-kit/renderDisplaySvg'
import { SvgClipRect } from '@jbrowse/plugin-linear-genome-view'

import { ArcsSvg } from './Arcs.tsx'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'
import type { LgvSvgBodyProps } from '@jbrowse/display-kit/renderDisplaySvg'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type React from 'react'

/**
 * **This module is the lazy boundary for the export path, not a shim.**
 * `ArcFetchModel.renderSvg` reaches the export code through exactly one
 * `import()`, and everything the export needs is a plain static import here,
 * behind it. One edge for both displays, because the arcs they export are one
 * list (`model.laidOutArcs`) painted by one component.
 *
 * It reads like an indirection worth deleting, and it was deleted once: the
 * imports moved into the model as a `Promise.all` of `import()`s. That works and
 * it is worse — one edge module means one dynamic import and one chunk, against
 * a second dynamic import in the hot path of every arc display.
 *
 * The bare-node parameter is the boundary's: the shared model cannot name either
 * display's type without a circular reference, so the narrowing is here.
 *
 * Bezier-arc-overlay exception (see agent-docs/reference/SVG_EXPORT.md): the
 * export emits one `<path>` per arc rather than routing through paintLayer, so a
 * figure gets vector. The ON-SCREEN body is a canvas, and both take their
 * geometry from `laidOutArcs`, so neither can place an arc the other did not.
 *
 * Passes no ExportSvgDisplayOptions: with no paintLayer there is no
 * rasterizeLayers/createCanvas to honor, and the theme arrives through the
 * export root's ThemeProvider. The displays' renderSvg actions still accept opts
 * because the export framework calls them with it.
 */
export async function renderArcSvg(
  model: IStateTreeNode,
): Promise<React.ReactNode> {
  return renderDisplaySvg(
    model as ArcDisplayModel,
    undefined,
    function ArcsSvgBody(props: LgvSvgBodyProps<ArcDisplayModel>) {
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
          <ArcsSvg arcs={props.model.laidOutArcs} />
        </SvgClipRect>
      )
    },
  )
}
