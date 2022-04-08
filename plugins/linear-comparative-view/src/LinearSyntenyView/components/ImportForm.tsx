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
  const [bed2Location, setBed2Location] = useState<FileLocation>()
  const [bed1Location, setBed1Location] = useState<FileLocation>()
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
    } else if (radioOption === '.anchors') {
      return {
        type: 'MCScanAnchorsAdapter',
        mcscanAnchorsLocation: trackData,
        bed1Location,
        bed2Location,
        assemblyNames: selected,
      }
    } else if (radioOption === '.anchors.simple') {
      return {
        type: 'MCScanSimpleAnchorsAdapter',
        mcscanSimpleAnchorsLocation: trackData,
        bed1Location,
        bed2Location,
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
              type: 'LinearGenomeView' as const,
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
                extra={index}
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
          <b>Optional</b>: Add a .paf, .out (MashMap), .delta (Mummer), .chain,
          .anchors or .anchors.simple (MCScan) file to view in the synteny view.
          These file types can also be gzipped. The first assembly should be the
          query sequence (e.g. left column of the PAF) and the second assembly
          should be the target sequence (e.g. right column of the PAF)
        </Typography>
        <RadioGroup
          value={radioOption}
          onChange={event => setValue(event.target.value)}
        >
          <Grid container justifyContent="center">
            <Grid item>
              <FormControlLabel value=".paf" control={<Radio />} label=".paf" />
            </Grid>
            <Grid item>
              <FormControlLabel value=".out" control={<Radio />} label=".out" />
            </Grid>
            <Grid item>
              <FormControlLabel
                value=".delta"
                control={<Radio />}
                label=".delta"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                value=".chain"
                control={<Radio />}
                label=".chain"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                value=".anchors"
                control={<Radio />}
                label=".anchors"
              />
            </Grid>
            <Grid item>
              <FormControlLabel
                value=".anchors.simple"
                control={<Radio />}
                label=".anchors.simple"
              />
            </Grid>
          </Grid>
        </RadioGroup>
        <Grid container justifyContent="center">
          <Grid item>
            {value === '.anchors' || value === '.anchors.simple' ? (
              <div>
                <div style={{ margin: 20 }}>
                  Open the {value}, and .bed files for both genome assemblies
                  from the MCScan (Python verson) pipeline{' '}
                  <a href="https://github.com/tanghaibao/jcvi/wiki/MCscan-(Python-version)">
                    (more info)
                  </a>
                </div>
                <div style={{ display: 'flex' }}>
                  <div>
                    <FileSelector
                      name=".anchors file"
                      description=""
                      location={trackData}
                      setLocation={loc => setTrackData(loc)}
                    />
                  </div>
                  <div>
                    <FileSelector
                      name="genome 1 .bed (left column of anchors file)"
                      description=""
                      location={bed1Location}
                      setLocation={loc => setBed1Location(loc)}
                    />
                  </div>
                  <div>
                    <FileSelector
                      name="genome 2 .bed (right column of anchors file)"
                      description=""
                      location={bed2Location}
                      setLocation={loc => setBed2Location(loc)}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <FileSelector
                name={value ? value + ' location' : ''}
                description=""
                location={trackData}
                setLocation={loc => setTrackData(loc)}
              />
            )}
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
