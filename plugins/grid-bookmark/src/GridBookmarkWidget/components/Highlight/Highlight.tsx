import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import {
  getSession,
  isSessionModelWithWidgets,
  notEmpty,
} from '@jbrowse/core/util'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// icons
import BookmarkIcon from '@mui/icons-material/Bookmark'

// locals
import { Tooltip } from '@mui/material'
import { GridBookmarkModel } from '../../model'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
    textAlign: 'center',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'start',
  },
})

const intensify = (rgba: string, opacity: number) => {
  if (rgba) {
    const values = rgba.replaceAll(/[^\d,.]/g, '').split(',')
    const originalOpacity = values.pop()
    // originalOpacity !== '0' assumes if the user has set the opacity of this highlight to 0, they probably don't want to see the label either
    const n = `rgba(${values.join(', ')}, ${
      originalOpacity !== '0' ? opacity : 0
    })`
    return n
  }
  return `rgba(0,0,0,0)`
}

const Highlight = observer(function Highlight({ model }: { model: LGV }) {
  const { classes } = useStyles()

  const session = getSession(model)
  if (!isSessionModelWithWidgets(session)) {
    return null
  }

  let bookmarkWidget = session.widgets.get('GridBookmark') as GridBookmarkModel
  if (!bookmarkWidget) {
    bookmarkWidget = session.addWidget(
      'GridBookmarkWidget',
      'GridBookmark',
    ) as GridBookmarkModel
  }

  const { showBookmarkHighlights, showBookmarkLabels } = model
  const assemblyNames = new Set(session.assemblyNames)
  const { bookmarks } = bookmarkWidget

  return (
    <>
      {showBookmarkHighlights
        ? bookmarks
            .filter(value => assemblyNames.has(value.assemblyName))
            .map(r => {
              const s = model.bpToPx({
                refName: r.refName,
                coord: r.start,
              })
              const e = model.bpToPx({
                refName: r.refName,
                coord: r.end,
              })
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
                key={`${left}_${width}_${idx}`}
                className={classes.highlight}
                style={{ left, width, background: highlight }}
              >
                {showBookmarkLabels ? (
                  <Tooltip title={label} arrow>
                    <BookmarkIcon
                      fontSize="small"
                      sx={{ color: `${intensify(highlight, 0.8)}` }}
                    />
                  </Tooltip>
                ) : null}
              </div>
            ))
        : null}
    </>
  )
})

export default Highlight
