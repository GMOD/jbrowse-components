import React from 'react'
import { getBpDisplayStr } from '@jbrowse/core/util'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import DotplotControls from './DotplotControls'
import DotplotWarnings from './DotplotWarnings'
import PanButtons from './PanButtons'
import type { DotplotViewModel } from '../model'

const useStyles = makeStyles()({
  bp: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 10,
  },
  spacer: {
    flexGrow: 1,
  },
  headerBar: {
    display: 'flex',
    position: 'relative',
  },
})

const DotplotHeader = observer(function ({
  model,
  selection,
}: {
  model: DotplotViewModel
  selection?: { width: number; height: number }
}) {
  const { classes } = useStyles()
  const { hview, vview, showPanButtons } = model
  return (
    <div className={classes.headerBar}>
      <DotplotControls model={model} />
      <Typography className={classes.bp} variant="body2" color="textSecondary">
        x: {hview.assemblyNames.join(',')} {getBpDisplayStr(hview.currBp)}
        <br />
        y: {vview.assemblyNames.join(',')} {getBpDisplayStr(vview.currBp)}
      </Typography>
      {selection ? (
        <Typography
          className={classes.bp}
          variant="body2"
          color="textSecondary"
        >
          {`width:${getBpDisplayStr(hview.bpPerPx * selection.width)}`} <br />
          {`height:${getBpDisplayStr(vview.bpPerPx * selection.height)}`}
        </Typography>
      ) : null}
      <div className={classes.spacer} />
      <DotplotWarnings model={model} />
      {showPanButtons ? <PanButtons model={model} /> : null}
    </div>
  )
})

export default DotplotHeader
