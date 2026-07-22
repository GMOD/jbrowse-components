import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import DotplotControls from './DotplotControls.tsx'
import DotplotWarnings from './DotplotWarnings.tsx'

import type { DotplotViewModel } from '../model.ts'
import type { DotplotInteraction } from './useDotplotInteraction.ts'

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

const DotplotHeader = observer(function DotplotHeader({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const { classes } = useStyles()
  const { hview, vview } = model
  const { selecting, dx, dy } = interaction
  return (
    <div className={classes.headerBar}>
      <DotplotControls model={model} />
      <Typography className={classes.bp} variant="body2" color="text.secondary">
        x: {hview.assemblyNames.join(',')} {getBpDisplayStr(hview.currBp)}
        <br />
        y: {vview.assemblyNames.join(',')} {getBpDisplayStr(vview.currBp)}
      </Typography>
      {selecting ? (
        <Typography
          className={classes.bp}
          variant="body2"
          color="text.secondary"
        >
          {`width:${getBpDisplayStr(hview.bpPerPx * Math.abs(dx))}`} <br />
          {`height:${getBpDisplayStr(vview.bpPerPx * Math.abs(dy))}`}
        </Typography>
      ) : null}
      <div className={classes.spacer} />
      <DotplotWarnings model={model} />
    </div>
  )
})

export default DotplotHeader
