import React from 'react'
import { Button, Paper, Typography, makeStyles } from '@material-ui/core'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { observer } from 'mobx-react'

// locals
import Header from './Header'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import MiniControls from './MiniControls'
import SequenceDialog from './SequenceDialog'
import SearchResultsDialog from './SearchResultsDialog'

const useStyles = makeStyles(theme => ({
  note: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  dots: {
    '&::after': {
      display: 'inline-block',
      animation: '$ellipsis 1.5s infinite',
      content: '"."',
      width: '1em',
      textAlign: 'left',
    },
  },
  miniControls: {
    position: 'absolute',
    right: 0,
    zIndex: 1001,
  },
  '@keyframes ellipsis': {
    '0%': {
      content: '"."',
    },
    '33%': {
      content: '".."',
    },
    '66%': {
      content: '"..."',
    },
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LinearGenomeView = observer(({ model }: { model: any }) => {
  const { tracks, error, hideHeader, initialized, hasDisplayedRegions } = model
  const classes = useStyles()

  if (!initialized && !error) {
    return (
      <Typography className={classes.dots} variant="h5">
        Loading
      </Typography>
    )
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

      {!hideHeader ? <Header model={model} /> : null}
      {hideHeader ? (
        <div className={classes.miniControls}>
          <MiniControls model={model} />
        </div>
      ) : null}
      <TracksContainer model={model}>
        {!tracks.length ? (
          <Paper variant="outlined" className={classes.note}>
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
          </Paper>
        ) : (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          tracks.map((track: any) => (
            <TrackContainer key={track.id} model={model} track={track} />
          ))
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeView
