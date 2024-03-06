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
  const { classes } = useStyles()
  const { cytobandOffset } = model
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

  return (
    <>
      {showBookmarkHighlights && bookmarks.current
        ? bookmarks.current
            .filter(value => assemblyNames.has(value.assemblyName))
            .map(r => {
              const s = overview.bpToPx({
                ...r,
                coord: r.reversed ? r.end : r.start,
              })
              const e = overview.bpToPx({
                ...r,
                coord: r.reversed ? r.start : r.end,
              })
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
            .map(({ left, width, highlight, label }, idx) => (
              <>
                {showBookmarkLabels ? (
                  <Tooltip title={label} arrow>
                    <div
                      key={`${left}_${width}_${idx}`}
                      className={classes.highlight}
                      style={{
                        left,
                        width,
                        background: highlight,
                      }}
                    />
                  </Tooltip>
                ) : (
                  <div
                    key={`${left}_${width}_${idx}`}
                    className={classes.highlight}
                    style={{
                      left,
                      width,
                      background: highlight,
                    }}
                  />
                )}
              </>
            ))
        : null}
    </>
  )
})

export default OverviewHighlight
