import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { getEnv } from '@jbrowse/core/util'

import SVGHighlights from './SVGHighlights.tsx'

import type { LinearGenomeViewModel } from '../index.ts'
import type { ReactNode } from 'react'

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
  const bookmarkHighlights = pluginManager.evaluateExtensionPoint(
    /** #extensionPoint LinearGenomeView-HighlightSVGComponent | sync | Add an SVG highlight overlay in the LGV SVG export */
    'LinearGenomeView-HighlightSVGComponent',
    [] as ReactNode[],
    { model, height: tracksHeight },
  )
  return (
    <SvgClipRect
      id={`highlight-clip-${model.id}`}
      width={model.width}
      height={tracksHeight}
    >
      <SVGHighlights model={model} height={tracksHeight} />
      {bookmarkHighlights}
    </SvgClipRect>
  )
}
