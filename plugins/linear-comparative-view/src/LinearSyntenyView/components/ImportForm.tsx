import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import {
  Button,
  Container,
  Grid,
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

const ImportForm = observer(({ model }: { model: LinearSyntenyViewModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [trackData, setTrackData] = useState<FileLocation>({ uri: '' })
  const [selected, setSelected] = useState([assemblyNames[0], assemblyNames[0]])
  const [numRows] = useState(2)
  const error = assemblyNames.length ? '' : 'No configured assemblies'

  async function onOpenClick() {
    const { assemblyManager } = session

    model.setViews(
      // @ts-ignore
      await Promise.all(
        selected
          .map(async selection => {
            const assembly = await assemblyManager.waitForAssembly(selection)
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
        assemblyNames: selected,
        type: 'SyntenyTrack',
        adapter: {
          type: 'PAFAdapter',
          pafLocation: trackData,
          assemblyNames: selected,
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
              justifyContent="center"
              spacing={4}
              alignItems="center"
            >
              <Grid item>
                <p style={{ textAlign: 'center' }}>
                  Select assemblies for synteny view
                </p>
                {[...new Array(numRows)].map((_, index) => (
                  <AssemblySelector
                    key={`row_${index}_${selected[index]}`}
                    selected={selected[index]}
                    onChange={val => {
                      // splice the value into the current array
                      const copy = selected.slice(0)
                      copy[index] = val
                      setSelected(copy)
                    }}
                    session={session}
                  />
                ))}
              </Grid>
            </Grid>
          </Paper>

          <Paper className={classes.formPaper}>
            <Grid container justifyContent="center">
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
          <Grid container justifyContent="center">
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
