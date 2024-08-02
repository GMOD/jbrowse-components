import React, { useEffect } from 'react'
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
    position: 'absolute',
    overflow: 'hidden',
  },
})

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()
  const session = getSession(model) as SessionWithWidgets
  const { assemblyManager } = session
  const { showBookmarkHighlights, showBookmarkLabels } = model

  const bookmarkWidget = session.widgets.get(
    'GridBookmark',
  ) as GridBookmarkModel

  useEffect(() => {
    if (!bookmarkWidget) {
      session.addWidget(
        'GridBookmarkWidget',
        'GridBookmark',
      ) as GridBookmarkModel
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
              }
            : undefined
        })
        .filter(notEmpty)
        .map(({ left, width, highlight, label }, idx) => (
          <div
            /* biome-ignore lint/suspicious/noArrayIndexKey: */
            key={`${left}_${width}_${idx}`}
            className={classes.highlight}
            style={{
              left,
              width,
              background: highlight,
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
