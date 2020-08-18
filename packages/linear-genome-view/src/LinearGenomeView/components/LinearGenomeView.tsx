import { getSession, isSessionModelWithWidgets } from '@gmod/jbrowse-core/util'

// material ui things
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'

// misc
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'

// locals
import { LinearGenomeViewStateModel } from '..'
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import MiniControls from './MiniControls'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  errorMessage: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}))

const LinearGenomeView = observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error, hideHeader, initialized } = model
  const classes = useStyles()
  const session = getSession(model)

  return !initialized ? (
    <ImportForm model={model} />
  ) : (
    <div style={{ position: 'relative' }}>
      {!hideHeader ? (
        <Header model={model} />
      ) : (
        <div
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 100000,
          }}
        >
          <MiniControls model={model} />
        </div>
      )}
      {error ? (
        <Paper variant="outlined" className={classes.errorMessage}>
          <Typography color="error">{error.message}</Typography>
        </Paper>
      ) : (
        <TracksContainer model={model}>
          {!tracks.length ? (
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
            </Paper>
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
