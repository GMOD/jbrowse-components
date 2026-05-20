import { Fragment, useEffect } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession, notEmpty } from '@jbrowse/core/util'
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
  bookmarkButton: {
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 800,
    pointerEvents: 'auto',
  },
  highlight: {
    overflow: 'hidden',
    height: '100%',
    position: 'absolute',
    // let clicks pass through the colored band to features on the
    // underlying track; only the bookmark chip should catch clicks
    pointerEvents: 'none',
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

  const set = new Set(model.assemblyNames)

  return bookmarkHighlightsVisible && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(value => set.has(value.assemblyName))
        .map(r => {
          const coords = getHighlightCoords(model, r)
          return coords
            ? {
                ...coords,
                highlight: r.highlight,
                label: r.label,
                bookmark: r,
              }
            : undefined
        })
        .filter(notEmpty)
        .map(({ left, width, highlight, label, bookmark }, idx) => (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <Fragment key={`${left}_${width}_${idx}`}>
            <div
              className={classes.highlight}
              id="highlight"
              style={{
                left,
                width,
                background: highlight,
              }}
            />
            {bookmarkLabelsVisible && width > 20 ? (
              <div className={classes.bookmarkButton} style={{ left }}>
                <CascadingMenuButton
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
                        bookmarkWidget.removeBookmarkObject(bookmark)
                      },
                    },
                  ]}
                >
                  <Tooltip title={label} arrow>
                    <BookmarkIcon
                      fontSize="small"
                      sx={{
                        color:
                          colord(highlight).alpha() !== 0
                            ? colord(highlight).alpha(0.8).toRgbString()
                            : colord(highlight).alpha(0).toRgbString(),
                      }}
                    />
                  </Tooltip>
                </CascadingMenuButton>
              </div>
            ) : null}
          </Fragment>
        ))
    : null
})

export default Highlight
