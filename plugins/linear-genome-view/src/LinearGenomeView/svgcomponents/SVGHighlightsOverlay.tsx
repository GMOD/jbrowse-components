import { PluggableElements } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'

import SVGHighlights from './SVGHighlights.tsx'

import type { BandGap } from '../components/SVGHighlightBand.tsx'
import type { LinearGenomeViewModel } from '../index.ts'

// The highlight layer over one view's tracks area: the view's highlights plus
// whatever plugins contribute. SVGViewChrome clips it to the view width and
// translates it to the top-left of the tracks area.
export default function SVGHighlightsOverlay({
  model,
  tracksHeight,
  gaps,
}: {
  model: LinearGenomeViewModel
  tracksHeight: number
  gaps: BandGap[]
}) {
  const { pluginManager } = getEnv(model)
  return (
    <>
      <SVGHighlights model={model} height={tracksHeight} gaps={gaps} />
      <PluggableElements
        pluginManager={pluginManager}
        name="LinearGenomeView-HighlightSVGComponent"
        props={{ model, height: tracksHeight }}
      />
    </>
  )
}
