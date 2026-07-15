import { getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import SVGHighlightBand from '../components/SVGHighlightBand.tsx'
import { getHighlightColor, highlightKey } from '../components/util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

// Native LGV highlights (model.highlight) drawn as full-height bands over the
// tracks area, with an optional label at the top. Bookmark highlights are added
// separately via the LinearGenomeView-HighlightSVGComponent extension point.
const SVGHighlights = observer(function SVGHighlights({
  model,
  height,
}: {
  model: LinearGenomeViewModel
  height: number
}) {
  const theme = useTheme()
  return getSession(model).highlightsVisible
    ? model.highlight.map((h, idx) => {
        const coords = model.getHighlightCoords(h)
        return coords ? (
          <SVGHighlightBand
            key={highlightKey(h, idx)}
            coords={coords}
            height={height}
            color={getHighlightColor(h, theme).toRgbString()}
            label={model.labelsVisible ? h.label : undefined}
            labelColor={theme.palette.text.primary}
          />
        ) : null
      })
    : null
})

export default SVGHighlights
