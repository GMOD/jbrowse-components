import { useEffect } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { HighlightBand } from '@jbrowse/plugin-linear-genome-view'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

type LGV = IExtendedLGV

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const session = getSession(model) as SessionWithWidgets
  const { bookmarkHighlightsVisible, bookmarkLabelsVisible } = model

  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined

  useEffect(() => {
    if (!bookmarkWidget) {
      session.addWidget('GridBookmarkWidget', 'GridBookmark')
    }
  }, [session, bookmarkWidget])

  const viewAssemblies = new Set(model.assemblyNames)

  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(r => viewAssemblies.has(r.assemblyName))
        .map((r, idx) => {
          const coords = model.getHighlightCoords(r)
          const bandColor = colord(r.highlight)
          // match band color but bump alpha to 0.8 so the chip is legible;
          // if the band is fully transparent, hide the chip color too
          const chipAlpha = bandColor.alpha() === 0 ? 0 : 0.8
          return coords ? (
            <HighlightBand
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              key={`${coords.left}_${coords.width}_${idx}`}
              coords={coords}
              background={r.highlight}
            >
              {bookmarkLabelsVisible ? (
                <CascadingMenuButton
                  menuItems={[
                    {
                      label: 'Open bookmark widget',
                      onClick: () => {
                        session.showWidget(bookmarkWidget)
                      },
                    },
                    {
                      label: 'Turn off bookmark highlights',
                      onClick: () => {
                        bookmarkWidget.setBookmarkHighlightsVisible(false)
                      },
                    },
                    {
                      label: 'Remove bookmark',
                      onClick: () => {
                        bookmarkWidget.removeBookmarkObject(r)
                      },
                    },
                  ]}
                >
                  <Tooltip title={r.label} arrow>
                    <BookmarkIcon
                      fontSize="small"
                      sx={{ color: bandColor.alpha(chipAlpha).toRgbString() }}
                    />
                  </Tooltip>
                </CascadingMenuButton>
              ) : null}
            </HighlightBand>
          ) : null
        })
    : null
})

export default Highlight
