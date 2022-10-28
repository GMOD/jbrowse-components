import React from 'react'
import { Button, Paper, Typography } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { ErrorBoundary } from 'react-error-boundary'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { ErrorMessage } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

// locals
import { LinearGenomeViewModel } from '..'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'
import ImportForm from './ImportForm'
import GetSequenceDialog from './GetSequenceDialog'
import SearchResultsDialog from './SearchResultsDialog'

type LGV = LinearGenomeViewModel

const useStyles = makeStyles()(theme => ({
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

const LinearGenomeView = observer(({ model }: { model: LGV }) => {
  const { tracks, error, initialized, hasDisplayedRegions } = model
  const { classes } = useStyles()

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

  const MiniControlsComponent = model.MiniControlsComponent()
  const HeaderComponent = model.HeaderComponent()

  return (
    <div style={{ position: 'relative' }}>
      {model.seqDialogDisplayed ? (
        <GetSequenceDialog
          model={model}
          handleClose={() => model.setGetSequenceDialogOpen(false)}
        />
      ) : null}
      {model.isSearchDialogDisplayed ? (
        <SearchResultsDialog
          model={model}
          handleClose={() => model.setSearchResults(undefined, undefined)}
        />
      ) : null}
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
            <ErrorBoundary
              key={track.id}
              FallbackComponent={({ error }) => <ErrorMessage error={error} />}
            >
              <TrackContainer model={model} track={track} />
            </ErrorBoundary>
          ))
        )}
      </TracksContainer>
    </div>
  )
})

export default LinearGenomeView
