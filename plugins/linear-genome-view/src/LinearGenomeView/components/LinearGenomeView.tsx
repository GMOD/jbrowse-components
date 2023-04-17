import React from 'react'
import { Button, Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { LoadingEllipses } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// locals
import { LinearGenomeViewModel } from '..'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
  note: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}))

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks, error, initialized, hasDisplayedRegions } = model
  const { classes } = useStyles()

  if (!initialized && !error) {
    return <LoadingEllipses variant="h6" />
  }
  if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  }

  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()

  return (
    <div style={{ position: 'relative' }}>
      <HeaderComponent model={model} />
      <MiniControlsComponent model={model} />
      <TracksContainer model={model}>
        {!tracks.length ? (
          <Paper variant="outlined" className={classes.note}>
            {!model.hideNoTracksActive ? (
              <>
                <Typography>No tracks active.</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={model.activateTrackSelector}
                  style={{ zIndex: 1000 }}
                  startIcon={<TrackSelectorIcon />}
                >
                  Open track selector
                </Button>
              </>
            ) : (
              <div style={{ height: '48px' }}></div>
            )}
          </Paper>
        ) : (
          tracks.map(track => (
            <TrackContainer key={track.id} model={model} track={track} />
          ))
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeView
