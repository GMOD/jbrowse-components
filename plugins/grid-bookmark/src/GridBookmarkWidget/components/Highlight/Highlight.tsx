import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { SessionWithWidgets, getSession, notEmpty } from '@jbrowse/core/util'
import { colord } from '@jbrowse/core/util/colord'
import { Tooltip } from '@mui/material'

// icons
import BookmarkIcon from '@mui/icons-material/Bookmark'

// locals
import { GridBookmarkModel } from '../../model'
import { IExtendedLGV } from '../../model'

type LGV = IExtendedLGV

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    overflow: 'hidden',
    position: 'absolute',
  },
})

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()

  const session = getSession(model) as SessionWithWidgets
  const { showBookmarkHighlights, showBookmarkLabels } = model
  const assemblyNames = new Set(session.assemblyNames)

  const bookmarkWidget = session.widgets.get(
    'GridBookmark',
  ) as GridBookmarkModel

  const bookmarks = useRef(bookmarkWidget?.bookmarks ?? [])

  useEffect(() => {
    if (!bookmarkWidget) {
      const newBookmarkWidget = session.addWidget(
        'GridBookmarkWidget',
        'GridBookmark',
      ) as GridBookmarkModel
      bookmarks.current = newBookmarkWidget.bookmarks
    }
  }, [session, bookmarkWidget])

  return showBookmarkHighlights && bookmarks.current
    ? bookmarks.current
        .filter(value => assemblyNames.has(value.assemblyName))
        .map(r => {
          const s = model.bpToPx({
            coord: r.start,
            refName: r.refName,
          })
          const e = model.bpToPx({
            coord: r.end,
            refName: r.refName,
          })
          return s && e
            ? {
                highlight: r.highlight,
                label: r.label,
                left: Math.min(s.offsetPx, e.offsetPx) - model.offsetPx,
                width: Math.max(Math.abs(e.offsetPx - s.offsetPx), 3),
              }
            : undefined
        })
        .filter(notEmpty)
        .map(({ left, width, highlight, label }, idx) => (
          <div
            key={`${left}_${width}_${idx}`}
            className={classes.highlight}
            style={{
              background: highlight,
              left,
              width,
            }}
          >
            {showBookmarkLabels ? (
              <Tooltip title={label} arrow>
                <BookmarkIcon
                  fontSize="small"
                  sx={{
                    color: `${
                      colord(highlight).alpha() !== 0
                        ? colord(highlight).alpha(0.8).toRgbString()
                        : colord(highlight).alpha(0).toRgbString()
                    }`,
                  }}
                />
              </Tooltip>
            ) : null}
          </div>
        ))
    : null
})

export default Highlight
