import { getFillProps } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'
import { bookmarkKey } from '../../utils.ts'

import type { IExtendedLGV } from '../../model.ts'

// Bookmark highlights drawn as full-height SVG bands for the LGV SVG export,
// mirroring the on-screen HighlightBand divs, with an optional label at the top.
const LGVHighlightSVG = observer(function LGVHighlightSVG({
  model,
  height,
}: {
  model: IExtendedLGV
  height: number
}) {
  const theme = useTheme()
  const { bookmarks } = getBookmarkHighlights(model)
  const { labelsVisible } = model

  return bookmarks.map((r, idx) => {
    const coords = model.getHighlightCoords(r)
    return coords ? (
      // eslint-disable-next-line @eslint-react/no-array-index-key
      <g key={`${bookmarkKey(r)}_${idx}`}>
        <rect
          x={coords.left}
          y={0}
          width={coords.width}
          height={height}
          {...getFillProps(r.highlight)}
        />
        {labelsVisible && r.label && coords.width > 3 ? (
          <text
            x={coords.left + 3}
            y={2}
            fontSize={11}
            dominantBaseline="hanging"
            {...getFillProps(theme.palette.text.primary)}
          >
            {r.label}
          </text>
        ) : null}
      </g>
    ) : null
  })
})

export default LGVHighlightSVG
