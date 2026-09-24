import { getBpDisplayStr } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { TrackWarningsButton } from '@jbrowse/synteny-core'
import { DialogContentText, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import DotplotControls from './DotplotControls.tsx'

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
      <TrackWarningsButton
        model={model}
        noun="dotplot"
        title="Dotplot rendered with warnings"
      >
        <DialogContentText>
          Found warnings while rendering the dotplot. This is often due to
          out-of-bound features that may indicate the wrong assemblies are being
          used. Check that the query and target are configured correctly, and
          that the right assemblies are being compared.
        </DialogContentText>
      </TrackWarningsButton>
    </div>
  )
})

export default DotplotHeader
