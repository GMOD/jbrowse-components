// material ui things
import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Typography from '@material-ui/core/Typography'
import { makeStyles } from '@material-ui/core/styles'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'

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
import AboutDialog from './AboutDialog'
import SequenceDialog from './SequenceDialog'
import BigsiDialog from './BigsiDialog'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  errorMessage: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  spacer: {
    marginRight: theme.spacing(2),
  },
}))

const LinearGenomeView = observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error, hideHeader, initialized, hasDisplayedRegions } = model
  const classes = useStyles()

  // the AboutDialog is shown at this level because if it is
  // rendered as a child of the TracksContainer, then clicking on
  // the dialog scrolls the LGV
  const aboutTrack = model.tracks.find(track => track.showAbout)
  const dialogTrack = model.tracks.find(track => track.DialogComponent)

  if (!initialized) {
    return null
  }
  if (!hasDisplayedRegions) {
    return <ImportForm model={model} />
  }
  return (
    <div style={{ position: 'relative' }}>
      {aboutTrack ? (
        <AboutDialog
          model={aboutTrack}
          handleClose={() => aboutTrack.setShowAbout(false)}
        />
      ) : null}
      {model.DialogComponent ? (
        <model.DialogComponent
          model={model}
          handleClose={() => model.setDialogComponent(undefined)}
        />
      ) : null}

      {dialogTrack ? (
        <dialogTrack.DialogComponent
          track={dialogTrack}
          display={dialogTrack.DialogDisplay}
          handleClose={() =>
            dialogTrack.setDialogComponent(undefined, undefined)
          }
        />
      ) : null}
      {model.isSeqDialogDisplayed ? (
        <SequenceDialog
          model={model}
          handleClose={() => {
            model.setOffsets(undefined, undefined)
          }}
        />
      ) : null}
      {model.isBigsiDialogDisplayed ? (
        <BigsiDialog
          model={model}
          handleClose={() => {
            model.setOffsets(undefined, undefined)
          }}
        />
      ) : null}
      {!hideHeader ? (
        <Header model={model} />
      ) : (
        <div
          style={{
            position: 'absolute',
            right: 0,
            zIndex: 1001,
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
        <>
          <TracksContainer model={model}>
            {!tracks.length ? (
              <Paper variant="outlined" className={classes.errorMessage}>
                <Typography>No tracks active.</Typography>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={model.activateTrackSelector}
                  style={{ zIndex: 1000 }}
                >
                  <TrackSelectorIcon className={classes.spacer} />
                  Open track selector
                </Button>
              </Paper>
            ) : (
              tracks.map(track => (
                <TrackContainer key={track.id} model={model} track={track} />
              ))
            )}
          </TracksContainer>
        </>
      )}
    </div>
  )
})

export default LinearGenomeView
