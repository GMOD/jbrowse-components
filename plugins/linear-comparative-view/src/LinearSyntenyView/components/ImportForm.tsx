import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Container,
  Grid,
  MenuItem,
  TextField,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { FileLocation } from '@jbrowse/core/util/types'
import { FileSelector } from '@jbrowse/core/ui'
import { LinearSyntenyViewModel } from '../model'

// the below importsused for multi-way synteny, not implemented yet
// import AddIcon from '@material-ui/icons/Add'
// import IconButton from '@material-ui/core/IconButton'
//

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
  formPaper: {
    maxWidth: 600,
    margin: '0 auto',
    padding: 12,
    marginBottom: 10,
  },
}))
const FormRow = observer(
  ({
    model,
    selected,
    onChange,
    error,
  }: {
    model: LinearSyntenyViewModel
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
const ImportForm = observer(({ model }: { model: LinearSyntenyViewModel }) => {
  const classes = useStyles()
  const [selected, setSelected] = useState([0, 0])
  const [numRows] = useState(2)
  const [trackData, setTrackData] = useState<FileLocation>({ uri: '' })
  const session = getSession(model)
  const { assemblyNames } = session
  const error = assemblyNames.length ? '' : 'No configured assemblies'

  async function onOpenClick() {
    const { assemblyManager } = session

    model.setViews(
      // @ts-ignore
      await Promise.all(
        selected
          .map(async selection => {
            const assembly = await assemblyManager.waitForAssembly(
              assemblyNames[selection],
            )
            if (assembly) {
              return {
                type: 'LinearGenomeView',
                bpPerPx: 1,
                offsetPx: 0,
                hideHeader: true,
                // @ts-ignore
                displayedRegions: getSnapshot(assembly.regions),
              }
            }
            return null
          })
          .filter(f => !!f),
      ),
    )

    model.views.forEach(view => view.setWidth(model.width))

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
      {error ? (
        <Typography color="error">{error}</Typography>
      ) : (
        <>
          <Paper className={classes.formPaper}>
            <Grid
              container
              item
              justify="center"
              spacing={4}
              alignItems="center"
            >
              <Grid item>
                <p style={{ textAlign: 'center' }}>
                  Select assemblies for synteny view
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
            </Grid>
          </Paper>

          <Paper className={classes.formPaper}>
            <Grid container justify="center">
              <p style={{ textAlign: 'center' }}>
                <b>Optional</b>: Add a PAF{' '}
                <a href="https://github.com/lh3/miniasm/blob/master/PAF.md">
                  (pairwise mapping format)
                </a>{' '}
                file for the linear synteny view. Note that the first assembly
                should be the left column of the PAF and the second assembly
                should be the right column
              </p>
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
          <Grid container justify="center">
            <Grid item>
              <Button onClick={onOpenClick} variant="contained" color="primary">
                Open
              </Button>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  )
})

export default ImportForm

/* ability to add another assembly commented out for now
    Add another assembly...
        <IconButton
          onClick={() => setNumRows(rows => rows + 1)}
          color="primary"
        >
          <AddIcon />
      </IconButton>
            */
