import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import {
  Button,
  Container,
  FormControlLabel,
  Radio,
  RadioGroup,
  Grid,
  Paper,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { FileLocation } from '@jbrowse/core/util/types'
import { FileSelector } from '@jbrowse/core/ui'
import { LinearSyntenyViewModel } from '../model'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
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

  const { assemblyNames, assemblyManager } = session
  const [selected, setSelected] = useState([assemblyNames[0], assemblyNames[0]])
  const [trackData, setTrackData] = useState<FileLocation>()
  const [numRows] = useState(2)
  const [value, setValue] = useState('PAF')
  const [error, setError] = useState<unknown>()
  const assemblyError = assemblyNames.length
    ? selected
        .map(a => assemblyManager.get(a)?.error)
        .filter(f => !!f)
        .join(', ')
    : 'No configured assemblies'

  async function onOpenClick() {
    try {
      if (!isSessionWithAddTracks(session)) {
        return
      }
      model.setViews(
        await Promise.all(
          selected.map(async selection => {
            const assembly = await assemblyManager.waitForAssembly(selection)
            if (!assembly) {
              throw new Error(`Assembly ${selection} failed to load`)
            }
            return {
              type: 'LinearGenomeView' as 'LinearGenomeView',
              bpPerPx: 1,
              offsetPx: 0,
              hideHeader: true,
              displayedRegions: assembly.regions,
            }
          }),
        ),
      )

      model.views.forEach(view => view.setWidth(model.width))

      if (trackData) {
        const name =
          'uri' in trackData
            ? trackData.uri.slice(trackData.uri.lastIndexOf('/') + 1)
            : 'MyTrack'

        const trackId = `${name}-${Date.now()}`
        session.addTrackConf({
          trackId,
          name,
          assemblyNames: selected,
          type: 'SyntenyTrack',
          adapter: {
            type: 'PAFAdapter',
            pafLocation: trackData,
            assemblyNames: selected,
          },
        })
        model.toggleTrack(trackId)
      }
    } catch (e) {
      console.error(e)
      setError(e)
    }
  }

  // this is a combination of any displayed error message we have
  const displayError = error || assemblyError
  return (
    <Container className={classes.importFormContainer}>
      {displayError ? <ErrorMessage error={displayError} /> : null}
      <Paper className={classes.formPaper}>
        <Grid
          container
          item
          justifyContent="center"
          spacing={4}
          alignItems="center"
        >
          <Grid item>
            <Typography>Select assemblies for synteny view</Typography>
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
        <Typography style={{ textAlign: 'center' }}>
          <b>Optional</b>: Add a PAF{' '}
          <a href="https://github.com/lh3/miniasm/blob/master/PAF.md">
            (pairwise mapping format)
          </a>{' '}
          or .delta file (mummer) file for the linear synteny view. Note that
          the first assembly should be the left column of the PAF and the second
          assembly should be the right column. PAF-like files from MashMap
          (.out) are also allowed
        </Typography>
        <RadioGroup
          value={value}
          onChange={event => setValue(event.target.value)}
        >
          <Grid container justifyContent="center">
            <Grid item>
              <FormControlLabel value="PAF" control={<Radio />} label="PAF" />
            </Grid>
            <Grid item>
              <FormControlLabel
                value="delta"
                control={<Radio />}
                label="Delta"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                value="other"
                control={<Radio />}
                label="Other"
              />
            </Grid>
          </Grid>
        </RadioGroup>
        <Grid container justifyContent="center">
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
          <Button
            // only disable button on assemblyError. for other types of errors
            // in the useState can retry
            disabled={!!assemblyError}
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

export default ImportForm
