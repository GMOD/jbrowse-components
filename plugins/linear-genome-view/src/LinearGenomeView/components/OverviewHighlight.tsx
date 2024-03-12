import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import { colord } from '@jbrowse/core/util/colord'
import {
  ParsedLocString,
  SessionWithWidgets,
  getSession,
} from '@jbrowse/core/util'
import { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'

// locals
import { LinearGenomeViewModel } from '../model'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    background: `${colord(theme.palette.highlight?.main ?? 'goldenrod')
      .alpha(0.35)
      .toRgbString()}`,
    borderLeft: `1px solid ${theme.palette.highlight?.main ?? 'goldenrod'}`,
    borderRight: `1px solid ${theme.palette.highlight?.main ?? 'goldenrod'}`,
  },
}))

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
  const { assemblyManager } = session

  // coords
  const mapCoords = (r: Required<ParsedLocString>) => {
    const s = overview.bpToPx({
      ...r,
      coord: r.reversed ? r.end : r.start,
    })

    const e = overview.bpToPx({
      ...r,
      coord: r.reversed ? r.start : r.end,
    })

    return s !== undefined && e != undefined
      ? {
          width: Math.abs(e - s),
          left: s + cytobandOffset,
        }
      : undefined
  }

  if (!model.highlight) {
    return null
  }

  const asm = assemblyManager.get(model.highlight?.assemblyName)

  const h = mapCoords({
    ...model.highlight,
    refName:
      asm?.getCanonicalRefName(model.highlight.refName) ??
      model.highlight.refName,
  })

  return (
    <>
      {h ? (
        <div
          className={classes.highlight}
          style={{
            width: h.width,
            left: h.left,
          }}
        />
      ) : null}
    </>
  )
})

export default OverviewHighlight
