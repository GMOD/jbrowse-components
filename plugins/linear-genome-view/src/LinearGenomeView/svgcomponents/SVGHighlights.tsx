import { getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'

import SVGHighlightBand from '../components/SVGHighlightBand.tsx'
import { getHighlightColor, highlightKey } from '../components/util.ts'

import type { LinearGenomeViewModel } from '../index.ts'

// Native LGV highlights (model.highlight) drawn as full-height bands over the
// tracks area, with an optional label at the top. Bookmark highlights are added
// separately via the LinearGenomeView-HighlightSVGComponent extension point.
//
// Deliberately NOT an observer, and that is the whole of what keeps a live
// figure coherent. `useViewSvgFigure` freezes a figure by memoizing it against
// its snapshot, which stops a parent render from advancing the drawing — but a
// `memo` cannot stop an observer inside it from re-rendering itself, and an
// observer here reads `getHighlightCoords`, i.e. `offsetPx`. A pan then slid the
// bands across track bodies that were still drawn where the snapshot left them.
// The file export renders the whole document in one synchronous pass, so it
// never needed the subscription either.
export default function SVGHighlights({
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
}
