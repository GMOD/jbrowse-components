import React, { useEffect } from 'react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession, notEmpty } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// icons

// locals
import type { GridBookmarkModel, IExtendedLGV } from '../../model'
import type { SessionWithWidgets } from '@jbrowse/core/util'

type LGV = IExtendedLGV

const useStyles = makeStyles()({
  bookmarkButton: {
    overflow: 'hidden',
    position: 'absolute',
    zIndex: 1000,
  },
  highlight: {
    overflow: 'hidden',
    height: '100%',
    position: 'absolute',
  },
})

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session
  const { showBookmarkHighlights, showBookmarkLabels } = model

  const bookmarkWidget = session.widgets.get('GridBookmark') as
    | GridBookmarkModel
    | undefined

  useEffect(() => {
    if (!bookmarkWidget) {
      session.addWidget('GridBookmarkWidget', 'GridBookmark')
    }
  }, [session, bookmarkWidget])

  const set = new Set(model.assemblyNames)

  return showBookmarkHighlights && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(value => set.has(value.assemblyName))
        .map(r => {
          const asm = assemblyManager.get(r.assemblyName)
          const refName = asm?.getCanonicalRefName(r.refName) ?? r.refName
          const s = model.bpToPx({ refName, coord: r.start })
          const e = model.bpToPx({ refName, coord: r.end })
          return s && e
            ? {
                width: Math.max(Math.abs(e.offsetPx - s.offsetPx), 3),
                left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
                highlight: r.highlight,
                label: r.label,
                bookmark: r,
              }
            : undefined
        })
        .filter(notEmpty)
        .map(({ left, width, highlight, label, bookmark }, idx) => (
          /* biome-ignore lint/suspicious/noArrayIndexKey: */
          <React.Fragment key={`${left}_${width}_${idx}`}>
            <div
              className={classes.highlight}
              id="highlight"
              style={{
                left,
                width,
                background: highlight,
              }}
            />
            {showBookmarkLabels && width > 20 ? (
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
          </React.Fragment>
        ))
    : null
})

export default Highlight
