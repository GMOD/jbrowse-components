import { getFillProps, getSession } from '@jbrowse/core/util'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

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
  const session = getSession(model) as SessionWithWidgets
  const { bookmarkHighlightsVisible, labelsVisible } = model
  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined
  const viewAssemblies = new Set(model.assemblyNames)

  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(r => viewAssemblies.has(r.assemblyName))
        .map((r, idx) => {
          const coords = model.getHighlightCoords(r)
          return coords ? (
            <g
              key={`${r.assemblyName}_${r.refName}_${r.start}_${r.end}_${idx}`}
            >
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
    : null
})

export default LGVHighlightSVG
