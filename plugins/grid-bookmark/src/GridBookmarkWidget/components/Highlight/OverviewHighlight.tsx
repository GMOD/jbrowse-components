import React, { useEffect, useRef } from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { SessionWithWidgets, getSession, notEmpty } from '@jbrowse/core/util'
import { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import { Tooltip } from '@mui/material'

// locals
import { GridBookmarkModel } from '../../model'
import { IExtendedLGV } from '../../model'

type LGV = IExtendedLGV

const useStyles = makeStyles()({
  highlight: {
    height: '100%',
    position: 'absolute',
  },
})

const OverviewHighlight = observer(function OverviewHighlight({
  model,
  overview,
}: {
  model: LGV
  overview: Base1DViewModel
}) {
  const { cytobandOffset } = model
  const session = getSession(model) as SessionWithWidgets
  const { classes } = useStyles()

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
          const rev = r.reversed
          const s = overview.bpToPx({ ...r, coord: rev ? r.end : r.start })
          const e = overview.bpToPx({ ...r, coord: rev ? r.start : r.end })
          return s !== undefined && e !== undefined
            ? {
                width: Math.abs(e - s),
                left: s + cytobandOffset,
                highlight: r.highlight,
                label: r.label,
              }
            : undefined
        })
        .filter(notEmpty)
        .map((obj, idx) => {
          const { left, width, highlight, label } = obj
          return (
            <Tooltip
              key={JSON.stringify(obj) + '-' + idx}
              title={showBookmarkLabels ? label : ''}
              arrow
            >
              <div
                className={classes.highlight}
                style={{
                  left,
                  width,
                  background: highlight,
                  borderLeft: `1px solid ${highlight}`,
                  borderRight: `1px solid ${highlight}`,
                }}
              />
            </Tooltip>
          )
        })
    : null
})

export default OverviewHighlight
