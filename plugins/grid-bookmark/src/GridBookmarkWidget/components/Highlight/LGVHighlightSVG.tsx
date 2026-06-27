import { SVGHighlightBand } from '@jbrowse/plugin-linear-genome-view'
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
      <SVGHighlightBand
        // eslint-disable-next-line @eslint-react/no-array-index-key -- bookmarks have no id and can duplicate; idx only breaks ties
        key={`${bookmarkKey(r)}_${idx}`}
        coords={coords}
        height={height}
        color={r.highlight}
        label={labelsVisible ? r.label : undefined}
        labelColor={theme.palette.text.primary}
      />
    ) : null
  })
})

export default LGVHighlightSVG
