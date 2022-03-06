import React, { useState } from 'react'
import path from 'path'
import { transaction } from 'mobx'
import { observer } from 'mobx-react'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
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
import { FileSelector, ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { LinearSyntenyViewModel } from '../model'

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

function getName(
  trackData?: { uri: string } | { localPath: string } | { name: string },
) {
  return trackData
    ? // @ts-ignore
      trackData.uri || trackData.localPath || trackData.name
    : undefined
}

function stripGz(fileName: string) {
  return fileName.endsWith('.gz')
    ? fileName.slice(0, fileName.length - 3)
    : fileName
}

const ImportForm = observer(({ model }: { model: LinearSyntenyViewModel }) => {
  const classes = useStyles()
  const session = getSession(model)

  const { assemblyNames, assemblyManager } = session
  const [selected, setSelected] = useState([assemblyNames[0], assemblyNames[0]])
  const [trackData, setTrackData] = useState<FileLocation>()
  const [numRows] = useState(2)
  const [error, setError] = useState<unknown>()

  const [value, setValue] = useState('')
  const fileName = getName(trackData)
  const radioOption = value || (fileName ? path.extname(stripGz(fileName)) : '')

  const assemblyError = assemblyNames.length
    ? selected
        .map(a => assemblyManager.get(a)?.error)
        .filter(f => !!f)
        .join(', ')
    : 'No configured assemblies'

  function getAdapter() {
    if (radioOption === '.paf') {
      return {
        type: 'PAFAdapter',
        pafLocation: trackData,
        assemblyNames: selected,
      }
    } else if (radioOption === '.out') {
      return {
        type: 'MashMapAdapter',
        outLocation: trackData,
        assemblyNames: selected,
      }
    } else if (radioOption === '.delta') {
      return {
        type: 'DeltaAdapter',
        deltaLocation: trackData,
        assemblyNames: selected,
      }
    } else if (radioOption === '.chain') {
      return {
        type: 'ChainAdapter',
        chainLocation: trackData,
        assemblyNames: selected,
      }
    } else {
      throw new Error('Unknown type')
    }
  }

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

      transaction(() => {
        if (trackData) {
          const fileName = path.basename(getName(trackData)) || 'MyTrack'
          const trackId = `${fileName}-${Date.now()}`

          session.addTrackConf({
            trackId: trackId,
            name: fileName,
            assemblyNames: selected,
            type: 'SyntenyTrack',
            adapter: getAdapter(),
          })

          model.toggleTrack(trackId)
        }
      })
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
          <b>Optional</b>: Add a .paf, .out (MashMap), .delta (Mummer), or
          .chain file to view in the dotplot. These file types can also be
          gzipped. The first assembly should be the query sequence (e.g. left
          column of the PAF) and the second assembly should be the target
          sequence (e.g. right column of the PAF)
        </Typography>
        <RadioGroup
          value={radioOption}
          onChange={event => setValue(event.target.value)}
        >
          <Grid container justifyContent="center">
            <Grid item>
              <FormControlLabel value=".paf" control={<Radio />} label="PAF" />
            </Grid>
            <Grid item>
              <FormControlLabel value=".out" control={<Radio />} label="Out" />
            </Grid>
            <Grid item>
              <FormControlLabel
                value=".delta"
                control={<Radio />}
                label="Delta"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                value=".chain"
                control={<Radio />}
                label="Chain"
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
