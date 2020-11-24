import React, { useState } from 'react'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { FileSelector } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import Button from '@material-ui/core/Button'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import { DotplotViewModel } from '../model'

export default () => {
  const useStyles = makeStyles(theme => ({
    importFormContainer: {
      padding: theme.spacing(4),
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
  const FormRow = observer(
    ({
      model,
      selected,
      onChange,
      error,
    }: {
      model: DotplotViewModel
      selected: number
      onChange: (arg0: number) => void
      error?: string
    }) => {
      const classes = useStyles()
      const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
      return (
        <Grid container item justify="center" spacing={2} alignItems="center">
          <TextField
            select
            variant="outlined"
            value={assemblyNames[selected] ? selected : ''}
            onChange={event => {
              onChange(Number(event.target.value))
            }}
            error={Boolean(error)}
            disabled={Boolean(error)}
            className={classes.importFormEntry}
          >
            {assemblyNames.map((name, idx) => (
              <MenuItem key={name} value={idx}>
                {name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      )
    },
  )
  const ImportForm = observer(({ model }: { model: DotplotViewModel }) => {
    const classes = useStyles()
    const [numRows] = useState(2)
    const [selected, setSelected] = useState([0, 0])
    const [error, setError] = useState('')
    const [trackData, setTrackData] = useState({ uri: '' })
    const { assemblyNames } = getSession(model) as { assemblyNames: string[] }
    if (!assemblyNames.length) {
      setError('No configured assemblies')
    }

    function onOpenClick() {
      model.setViews([
        { bpPerPx: 0.1, offsetPx: 0 },
        { bpPerPx: 0.1, offsetPx: 0 },
      ])
      model.setAssemblyNames([
        assemblyNames[selected[0]],
        assemblyNames[selected[1]],
      ])

      if (trackData.uri) {
        const fileName = trackData.uri
          ? trackData.uri.slice(trackData.uri.lastIndexOf('/') + 1)
          : null

        // @ts-ignore
        const configuration = getSession(model).addTrackConf({
          trackId: `fileName-${Date.now()}`,
          name: fileName,
          assemblyNames: selected.map(selection => assemblyNames[selection]),
          type: 'DotplotTrack',
          adapter: {
            type: 'PAFAdapter',
            pafLocation: trackData,
            assemblyNames: selected.map(selection => assemblyNames[selection]),
          },
          renderer: {
            type: 'DotplotRenderer',
          },
        })
        model.toggleTrack(configuration.trackId)
      }
    }

    return (
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <p style={{ textAlign: 'center' }}>
              Select assemblies for dotplot view
            </p>
            {[...new Array(numRows)].map((_, index) => (
              <FormRow
                key={`row_${index}_${selected[index]}`}
                error={error}
                selected={selected[index]}
                onChange={val => {
                  const copy = selected.slice(0)
                  copy[index] = val
                  setSelected(copy)
                }}
                model={model}
              />
            ))}
          </Grid>

          <Grid item>
            <Typography>Add a PAF file for the dotplot view</Typography>
            <FileSelector
              name="URL"
              description=""
              location={trackData}
              setLocation={setTrackData}
            />
          </Grid>
          <Grid item>
            <Button onClick={onOpenClick} variant="contained" color="primary">
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    )
  })
  return ImportForm
}
