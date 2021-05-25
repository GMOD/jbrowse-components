import React, { useState } from 'react'
import { FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Paper,
  Container,
  Grid,
  MenuItem,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
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
          inputProps={{ 'data-testid': 'dotplot-input' }}
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
const DotplotImportForm = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  const [numRows] = useState(2)
  const [selected, setSelected] = useState([0, 0])
  const [trackData, setTrackData] = useState<FileLocation>({ uri: '' })
  const session = getSession(model)
  const { assemblyNames } = session
  const error = assemblyNames.length ? '' : 'No configured assemblies'

  function onOpenClick() {
    model.setViews([
      { bpPerPx: 0.1, offsetPx: 0 },
      { bpPerPx: 0.1, offsetPx: 0 },
    ])
    model.setAssemblyNames([
      assemblyNames[selected[0]],
      assemblyNames[selected[1]],
    ])

    if ('uri' in trackData && trackData.uri) {
      const fileName = trackData.uri
        ? trackData.uri.slice(trackData.uri.lastIndexOf('/') + 1)
        : null

      // @ts-ignore
      const configuration = session.addTrackConf({
        trackId: `fileName-${Date.now()}`,
        name: fileName,
        assemblyNames: selected.map(selection => assemblyNames[selection]),
        type: 'SyntenyTrack',
        adapter: {
          type: 'PAFAdapter',
          pafLocation: trackData,
          assemblyNames: selected.map(selection => assemblyNames[selection]),
        },
      })
      model.toggleTrack(configuration.trackId)
    }
  }

  return (
    <Container className={classes.importFormContainer}>
      <Grid
        container
        spacing={1}
        justify="center"
        alignItems="center"
        style={{ width: '50%', margin: '0 auto' }}
      >
        {error ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <Grid item>
              <Paper style={{ padding: 12, marginBottom: 10 }}>
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
              </Paper>

              <Paper style={{ padding: 12, marginBottom: 10 }}>
                <p style={{ textAlign: 'center' }}>
                  <b>Optional</b>: Add a PAF{' '}
                  <a href="https://github.com/lh3/miniasm/blob/master/PAF.md">
                    (pairwise mapping format)
                  </a>{' '}
                  file for the dotplot view. Note that the first assembly should
                  be the left column of the PAF and the second assembly should
                  be the right column
                </p>
                <Grid container justify="center">
                  <Grid item>
                    <FileSelector
                      name="URL"
                      description=""
                      location={trackData}
                      setLocation={loc => setTrackData(loc)}
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
            <Grid item>
              <Button
                data-testid="submitDotplot"
                onClick={onOpenClick}
                variant="contained"
                color="primary"
              >
                Open
              </Button>
            </Grid>
          </>
        )}
      </Grid>
    </Container>
  )
})

export default DotplotImportForm
