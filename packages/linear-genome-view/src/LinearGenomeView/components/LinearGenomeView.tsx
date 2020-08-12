import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession, isSessionModelWithWidgets } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { LinearGenomeViewModel } from '..'
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles(theme => ({
  errorMessage: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}))

const NoTracksMessage = observer(({ model }: { model: LGV }) => {
  const session = getSession(model)
  const classes = useStyles()
  return model.showNoTracksMessage ? (
    <Paper variant="outlined" className={classes.errorMessage}>
      <Typography>No tracks active.</Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={model.activateTrackSelector}
        disabled={
          isSessionModelWithWidgets(session) &&
          session.visibleWidget &&
          session.visibleWidget.id === 'hierarchicalTrackSelector' &&
          // @ts-ignore
          session.visibleWidget.view.id === model.id
        }
      >
        Select Tracks
      </Button>
      <Button onClick={() => model.setShowNoTracksMessage(false)}>
        Hide message
      </Button>
    </Paper>
  ) : null
})

const LinearGenomeView = observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error, hideHeader, initialized } = model
  const classes = useStyles()

  return !initialized ? (
    <ImportForm model={model} />
  ) : (
    <div>
      {!hideHeader ? <Header model={model} /> : null}
      {error ? (
        <Paper variant="outlined" className={classes.errorMessage}>
          <Typography color="error">{error.message}</Typography>
        </Paper>
      ) : (
        <TracksContainer model={model}>
          {!tracks.length ? (
            <NoTracksMessage model={model} />
          ) : (
            tracks.map(track => (
              <TrackContainer key={track.id} model={model} track={track} />
            ))
          )}
        </TracksContainer>
      )}
    </div>
  )
})

export default LinearGenomeView
