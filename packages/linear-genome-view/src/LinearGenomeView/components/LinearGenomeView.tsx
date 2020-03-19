import { getSession } from '@gmod/jbrowse-core/util'
import { IRegion } from '@gmod/jbrowse-core/mst-types'

// material ui things
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'

// misc
import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React, { useState } from 'react'

// locals
import buttonStyles from './buttonStyles'
import RefNameAutocomplete from './RefNameAutocomplete'
import Header from './Header'
import Rubberband from './Rubberband'
import TrackContainer from './TrackContainer'
import ScaleBar from './ScaleBar'
import { LinearGenomeViewStateModel, SCALE_BAR_HEIGHT } from '..'

type LGV = Instance<LinearGenomeViewStateModel>

const useStyles = makeStyles(theme => ({
  root: {
    position: 'relative',
    marginBottom: theme.spacing(1),
    overflow: 'hidden',
    background: '#D9D9D9',
    // background: theme.palette.background.paper,
    boxSizing: 'content-box',
  },
  importFormContainer: {
    marginBottom: theme.spacing(4),
  },
  importFormEntry: {
    minWidth: 180,
  },
  noTracksMessage: {
    background: theme.palette.background.default,
    textAlign: 'center',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  ...buttonStyles(theme),
}))

const ImportForm = observer(({ model }) => {
  const classes = useStyles()
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<IRegion | undefined>()
  const [error, setError] = useState('')
  const {
    assemblyNames,
  }: {
    assemblyNames: string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = getSession(model) as any
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
  const { tracks, error } = model
  const classes = useStyles()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session: any = getSession(model)
  const initialized = !!model.displayedRegions.length
  return (
    <div className={classes.root}>
      {!initialized ? (
        <ImportForm model={model} />
      ) : (
        <>
          {!model.hideHeader ? <Header model={model} /> : null}
          {error ? (
            <div style={{ textAlign: 'center', color: 'red' }}>
              {error.message}
            </div>
          ) : (
            <>
              <Rubberband height={SCALE_BAR_HEIGHT} model={model}>
                <ScaleBar model={model} height={SCALE_BAR_HEIGHT} />
              </Rubberband>
              {!tracks.length ? (
                <Container className={classes.noTracksMessage}>
                  <Typography>No tracks active.</Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={model.activateTrackSelector}
                    disabled={
                      session.visibleDrawerWidget &&
                      session.visibleDrawerWidget.id ===
                        'hierarchicalTrackSelector' &&
                      session.visibleDrawerWidget.view.id === model.id
                    }
                  >
                    Select Tracks
                  </Button>
                </Container>
              ) : (
                tracks.map(track => (
                  <TrackContainer key={track.id} model={model} track={track} />
                ))
              )}
            </>
          )}
        </>
      )}
    </div>
  )
})

export default LinearGenomeView
