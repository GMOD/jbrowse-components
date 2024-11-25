import React, { useEffect } from 'react'
import { getSession, notEmpty } from '@jbrowse/core/util'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { GridBookmarkModel, IExtendedLGV } from '../../model'
import type { SessionWithWidgets } from '@jbrowse/core/util'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

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

  const assemblyNames = new Set(model.assemblyNames)
  return showBookmarkHighlights && bookmarkWidget?.bookmarks
    ? bookmarkWidget.bookmarks
        .filter(r => assemblyNames.has(r.assemblyName))
        .map(r => {
          const asm = assemblyManager.get(r.assemblyName)
          const refName = asm?.getCanonicalRefName(r.refName) ?? r.refName
          const rev = r.reversed
          const s = overview.bpToPx({ refName, coord: rev ? r.end : r.start })
          const e = overview.bpToPx({ refName, coord: rev ? r.start : r.end })
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
              key={`${JSON.stringify(obj)}-${idx}`}
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
