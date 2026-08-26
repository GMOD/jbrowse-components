import { highlightKey } from '@jbrowse/core/util/highlights'
import { SVGHighlightBand } from '@jbrowse/plugin-linear-genome-view'
import { useTheme } from '@mui/material'

import { getBookmarkHighlights } from './getBookmarkHighlights.ts'

import type { IExtendedLGV } from '../../model.ts'

// Bookmark highlights drawn as full-height SVG bands for the LGV SVG export,
// mirroring the on-screen HighlightBand divs, with an optional label at the top.
//
// Not an observer, for the reason SVGHighlights next door is not: it draws into
// a figure that `useViewSvgFigure` freezes with a `memo`, and a `memo` does not
// hold an observer still. Subscribing here made the bands pan away from the
// track bodies they were drawn over.
export default function LGVHighlightSVG({
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
        key={highlightKey(r, idx)}
        coords={coords}
        height={height}
        color={r.highlight}
        label={labelsVisible ? r.label : undefined}
        labelColor={theme.palette.text.primary}
      />
    ) : null
  })
}
