import { svgNodeId } from '@jbrowse/core/svg/svgId'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'

import MultiWayRows from './components/MultiWayRows.tsx'

import type { MultiWaySyntenyDisplayModel } from './model.ts'
import type { LgvSvgBodyProps } from '@jbrowse/plugin-linear-genome-view'

// the lazy boundary for the export path, same shape as the arc displays: the
// model's renderSvg reaches this through one import(), and the body renders the
// same vector JSX as on screen rather than a paintLayer
export async function renderMultiWaySvg(model: MultiWaySyntenyDisplayModel) {
  return renderDisplaySvg(
    model,
    undefined,
    function MultiWaySvgBody(
      props: LgvSvgBodyProps<MultiWaySyntenyDisplayModel>,
    ) {
      return (
        <SvgClipRect
          id={`multiway-${svgNodeId(props.model)}`}
          width={props.model.canvasWidth}
          height={props.height}
        >
          <MultiWayRows model={props.model} exportSVG />
        </SvgClipRect>
      )
    },
  )
}
