import React from 'react'
import { Button, Paper, Typography, makeStyles } from '@material-ui/core'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { observer } from 'mobx-react'

// locals
import { LinearGenomeViewModel } from '..'
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import MiniControls from './MiniControls'
import SequenceDialog from './SequenceDialog'
import SearchResultsDialog from './SearchResultsDialog'

type LGV = LinearGenomeViewModel

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

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks, error, hideHeader, initialized, hasDisplayedRegions } = model
  const classes = useStyles()

  if (!initialized && !error) {
    return null
  }
  if (!hasDisplayedRegions || error) {
    return <ImportForm model={model} />
  }
  return (
    <div style={{ position: 'relative' }}>
      {model.seqDialogDisplayed ? (
        <SequenceDialog
          model={model}
          handleClose={() => {
            model.setSequenceDialogOpen(false)
          }}
        />
      ) : null}
      {model.isSearchDialogDisplayed ? (
        <SearchResultsDialog
          model={model}
          handleClose={() => {
            model.setSearchResults(undefined, undefined)
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
    </div>
  )
})

export default LinearGenomeView
