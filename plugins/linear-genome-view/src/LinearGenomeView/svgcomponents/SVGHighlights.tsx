import { getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { getHighlightColor } from '../components/util.ts'

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
  return model.highlightsVisible
    ? model.highlight.map((h, idx) => {
        const coords = model.getHighlightCoords(h)
        return coords ? (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- highlights have no id and can duplicate; idx only breaks ties
          <g key={`${h.assemblyName}-${h.refName}-${h.start}-${h.end}-${idx}`}>
            <rect
              x={coords.left}
              y={0}
              width={coords.width}
              height={height}
              {...getFillProps(getHighlightColor(h, theme).toRgbString())}
            />
            {model.labelsVisible && h.label && coords.width > 3 ? (
              <text
                x={coords.left + 3}
                y={2}
                fontSize={11}
                dominantBaseline="hanging"
                {...getFillProps(theme.palette.text.primary)}
              >
                {h.label}
              </text>
            ) : null}
          </g>
        ) : null
      })
    : null
})

export default SVGHighlights
