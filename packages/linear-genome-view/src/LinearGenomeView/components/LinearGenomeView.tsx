import { Region } from '@gmod/jbrowse-core/util/types'
import { getSession } from '@gmod/jbrowse-core/util'

// material ui things
import Button from '@material-ui/core/Button'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import Paper from '@material-ui/core/Paper'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'

// misc
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useState } from 'react'

// locals
import { LinearGenomeViewStateModel } from '..'
import Header from './Header'
import RefNameAutocomplete from './RefNameAutocomplete'
import TrackContainer from './TrackContainer'
import TracksContainer from './TracksContainer'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    marginBottom: theme.spacing(4),
  },
  importFormEntry: {
    minWidth: 180,
  },
  errorMessage: {
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
}))

const ImportForm = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<Region | undefined>()
  const [error, setError] = useState('')
  const { assemblyNames } = getSession(model)
  if (!error && !assemblyNames.length) {
    setError('No configured assemblies')
  }

  function onAssemblyChange(
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setSelectedAssemblyIdx(Number(event.target.value))
  }

  function onOpenClick() {
    if (selectedRegion) {
      model.setDisplayedRegions([selectedRegion])
      model.setDisplayName(selectedRegion.assemblyName)
    }
  }

  return (
    <Container className={classes.importFormContainer}>
      <Grid container spacing={1} justify="center" alignItems="center">
        <Grid item>
          <TextField
            select
            variant="outlined"
            value={
              assemblyNames[selectedAssemblyIdx] && !error
                ? selectedAssemblyIdx
                : ''
            }
            onChange={onAssemblyChange}
            label="Assembly"
            helperText={error || 'Select assembly to view'}
            error={!!error}
            disabled={!!error}
            margin="normal"
            className={classes.importFormEntry}
          >
            {assemblyNames.map((name, idx) => (
              <MenuItem key={name} value={idx}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item>
          <RefNameAutocomplete
            model={model}
            assemblyName={
              error ? undefined : assemblyNames[selectedAssemblyIdx]
            }
            onSelect={setSelectedRegion}
            TextFieldProps={{
              margin: 'normal',
              variant: 'outlined',
              label: 'Sequence',
              className: classes.importFormEntry,
              helperText: 'Select sequence to view',
            }}
          />
        </Grid>
        <Grid item>
          <Button
            disabled={!selectedRegion}
            onClick={onOpenClick}
            variant="contained"
            color="primary"
          >
            Open
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

const LinearGenomeView = observer((props: { model: LGV }) => {
  const { model } = props
  const { tracks, error, hideHeader, initialized } = model
  const classes = useStyles()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = getSession(model) as any

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
            <Paper variant="outlined" className={classes.errorMessage}>
              <Typography>No tracks active.</Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={model.activateTrackSelector}
                disabled={
                  session.visibleWidget &&
                  session.visibleWidget.id === 'hierarchicalTrackSelector' &&
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
