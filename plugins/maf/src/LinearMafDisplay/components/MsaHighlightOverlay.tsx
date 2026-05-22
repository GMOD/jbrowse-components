import React from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { MsaHighlight } from '../util.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const useStyles = makeStyles()(theme => ({
  highlight: {
    position: 'absolute',
    top: 0,
    backgroundColor: alpha(theme.palette.highlight.main, 0.4),
    border: `1px solid ${alpha(theme.palette.highlight.main, 0.8)}`,
    pointerEvents: 'none',
  },
}))

function highlightBox(
  view: LinearGenomeViewModel,
  highlight: MsaHighlight,
): { left: number; width: number } | undefined {
  const s = view.bpToPx({ refName: highlight.refName, coord: highlight.start })
  const e = view.bpToPx({ refName: highlight.refName, coord: highlight.end })
  if (!s || !e) {
    return undefined
  }
  const left = Math.min(s.offsetPx, e.offsetPx) - view.offsetPx
  const width = Math.max(Math.abs(e.offsetPx - s.offsetPx), 2)
  return { left, width }
}

const MsaHighlightOverlay = observer(function MsaHighlightOverlay({
  model,
  view,
  height,
}: {
  model: { msaHighlights: MsaHighlight[] }
  view: LinearGenomeViewModel
  height: number
}) {
  const { classes } = useStyles()
  return (
    <>
      {model.msaHighlights.map((h, idx) => {
        const box = highlightBox(view, h)
        return box ? (
          <div
            key={`${h.refName}-${h.start}-${h.end}-${idx}`}
            className={classes.highlight}
            style={{ left: box.left, width: box.width, height }}
          />
        ) : null
      })}
    </>
  )
})

export default MsaHighlightOverlay
