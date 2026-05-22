import React from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function isConnectedMafSequenceWidget(
  w: unknown,
  viewId: string,
): w is MafSequenceWidgetModel {
  const candidate = w as Partial<MafSequenceWidgetModel> | null
  return (
    !!candidate &&
    candidate.type === 'MafSequenceWidget' &&
    candidate.connectedViewId === viewId
  )
}

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    background: alpha(theme.palette.primary.main, 0.4),
    borderLeft: `2px solid ${theme.palette.primary.main}`,
    borderRight: `2px solid ${theme.palette.primary.main}`,
    pointerEvents: 'none',
    zIndex: 10,
  },
}))

const MafSequenceHoverHighlight = observer(function MafSequenceHoverHighlight({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyManager } = session

  const widgets =
    'widgets' in session ? (session.widgets as Map<string, unknown>) : undefined
  if (!widgets) {
    return null
  }

  const highlights: React.ReactNode[] = []

  for (const widget of widgets.values()) {
    if (
      isConnectedMafSequenceWidget(widget, model.id) &&
      widget.hoverHighlight
    ) {
      const { refName, start, end, assemblyName } = widget.hoverHighlight
      const assembly = assemblyManager.get(assemblyName)
      const canonicalRefName = assembly?.getCanonicalRefName(refName) ?? refName

      const startPx = model.bpToPx({
        refName: canonicalRefName,
        coord: start,
      })
      const endPx = model.bpToPx({ refName: canonicalRefName, coord: end })

      if (startPx && endPx) {
        const left = Math.min(startPx.offsetPx, endPx.offsetPx) - model.offsetPx
        const width = Math.max(Math.abs(endPx.offsetPx - startPx.offsetPx), 3)

        highlights.push(
          <div
            key={`maf-hover-${widget.id}`}
            className={classes.highlight}
            style={{ left, width }}
          />,
        )
      }
    }
  }

  return <>{highlights}</>
})

export default MafSequenceHoverHighlight
