import { useEffect } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import { Tooltip } from '@mui/material'
import { getHighlightCoords } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { GridBookmarkModel, IExtendedLGV } from '../../model.ts'
import type { SessionWithWidgets } from '@jbrowse/core/util'

type LGV = IExtendedLGV

const useStyles = makeStyles()({
  highlight: {
    overflow: 'hidden',
    height: '100%',
    position: 'absolute',
    left: 0,
    // paint above sibling TrackContainers (which would otherwise win in
    // tree order). pointer-events:none lets clicks fall through to the
    // tracks except on the bookmark chip itself
    zIndex: 1,
    pointerEvents: 'none',
  },
  iconButton: {
    pointerEvents: 'auto',
  },
})

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
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
          const coords = getHighlightCoords(model, r)
          return coords ? (
            <div
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              key={`${coords.left}_${coords.width}_${idx}`}
              className={classes.highlight}
              style={{
                transform: `translateX(${coords.left}px)`,
                width: coords.width,
                background: r.highlight,
              }}
            >
              {bookmarkLabelsVisible && coords.width > 20 ? (
                <CascadingMenuButton
                  className={classes.iconButton}
                  menuItems={[
                    {
                      label: 'Open bookmark widget',
                      onClick: () => {
                        session.showWidget(bookmarkWidget)
                      },
                    },
                    {
                      label: 'Turn off highlights',
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
                      // match band color but bump alpha to 0.8 so the chip
                      // is legible; if the band is fully transparent, hide
                      // the chip color too
                      sx={{
                        color: colord(r.highlight)
                          .alpha(colord(r.highlight).alpha() === 0 ? 0 : 0.8)
                          .toRgbString(),
                      }}
                    />
                  </Tooltip>
                </CascadingMenuButton>
              ) : null}
            </div>
          ) : null
        })
    : null
})

export default Highlight
