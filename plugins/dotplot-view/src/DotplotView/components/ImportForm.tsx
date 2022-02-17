import React, { useState } from 'react'
import path from 'path'
import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Paper,
  Container,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { FileSelector, ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import { transaction } from 'mobx'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
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

const DotplotImportForm = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const [trackData, setTrackData] = useState<FileLocation>()
  const [selected1, setSelected1] = useState(assemblyNames[0])
  const [selected2, setSelected2] = useState(assemblyNames[0])
  const selected = [selected1, selected2]
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
        type: 'PAFAdapter',
        pafLocation: trackData,
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

  function onOpenClick() {
    try {
      if (!isSessionWithAddTracks(session)) {
        return
      }
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
        model.setViews([
          { bpPerPx: 0.1, offsetPx: 0 },
          { bpPerPx: 0.1, offsetPx: 0 },
        ])
        model.setAssemblyNames([selected1, selected2])
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
      <Grid
        container
        spacing={1}
        justifyContent="center"
        alignItems="center"
        style={{ width: '50%', margin: '0 auto' }}
      >
        <Grid item>
          <Paper style={{ padding: 12 }}>
            <p style={{ textAlign: 'center' }}>
              Select assemblies for dotplot view
            </p>
            <Grid
              container
              spacing={1}
              justifyContent="center"
              alignItems="center"
            >
              <Grid item>
                <Typography>Query</Typography>
                <AssemblySelector
                  selected={selected1}
                  onChange={val => setSelected1(val)}
                  session={session}
                />
              </Grid>
              <Grid item>
                <Typography>Target</Typography>
                <AssemblySelector
                  selected={selected2}
                  onChange={val => setSelected2(val)}
                  session={session}
                />
              </Grid>
            </Grid>
          </Paper>

          <Paper style={{ padding: 12 }}>
            <Typography style={{ textAlign: 'center' }}>
              <b>Optional</b>: Add a .paf, .out (MashMap), .delta (Mummer), or
              .chain file to view in the dotplot. These file types can also be
              gzipped. The first assembly should be the query sequence (e.g.
              left column of the PAF) and the second assembly should be the
              target sequence (e.g. right column of the PAF)
            </Typography>
            <RadioGroup
              value={radioOption}
              onChange={event => setValue(event.target.value)}
            >
              <Grid container justifyContent="center">
                <Grid item>
                  <FormControlLabel
                    value=".paf"
                    control={<Radio />}
                    label="PAF"
                  />
                </Grid>
                <Grid item>
                  <FormControlLabel
                    value=".out"
                    control={<Radio />}
                    label="Out"
                  />
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
        </Grid>
        <Grid item>
          <Button
            data-testid="submitDotplot"
            onClick={onOpenClick}
            // only disable button on assemblyError. for other types of errors
            // in the useState can retry
            disabled={!!assemblyError}
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

export default DotplotImportForm
