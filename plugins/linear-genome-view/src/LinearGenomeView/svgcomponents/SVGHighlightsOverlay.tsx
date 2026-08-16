import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { PluggableElements } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'

import SVGHighlights from './SVGHighlights.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

// The highlight layer over one view's tracks area: native LGV highlights plus
// whatever plugins contribute (bookmarks), clipped to the view width. Callers
// translate this to the top-left of the tracks area.
export default function SVGHighlightsOverlay({
  model,
  tracksHeight,
}: {
  model: LinearGenomeViewModel
  tracksHeight: number
}) {
  const { pluginManager } = getEnv(model)
  return (
    <SvgClipRect
      id={`highlight-clip-${svgNodeId(model)}`}
      width={model.width}
      height={tracksHeight}
    >
      <SVGHighlights model={model} height={tracksHeight} />
      <PluggableElements
        pluginManager={pluginManager}
        name="LinearGenomeView-HighlightSVGComponent"
        props={{ model, height: tracksHeight }}
      />
    </SvgClipRect>
  )
}
