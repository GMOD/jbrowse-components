import React, { useState } from 'react'
import { FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import {
  Button,
  Paper,
  Container,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
}))

const ErrorDisplay = observer(({ error }: { error?: Error | string }) => {
  return (
    <Typography variant="h6" color="error">
      {`${error}`}
    </Typography>
  )
})

const DotplotImportForm = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const [trackData, setTrackData] = useState<FileLocation>()
  const [selected1, setSelected1] = useState(assemblyNames[0])
  const [selected2, setSelected2] = useState(assemblyNames[0])
  const selected = [selected1, selected2]

  const asmError = selected
    .map(a => assemblyManager.get(a)?.error)
    .filter(f => !!f)
    .join(', ')
  const err = assemblyNames.length ? asmError : 'No configured assemblies'

  function onOpenClick() {
    model.setViews([
      { bpPerPx: 0.1, offsetPx: 0 },
      { bpPerPx: 0.1, offsetPx: 0 },
    ])
    model.setAssemblyNames([selected1, selected2])

    const fileName =
      trackData && 'uri' in trackData && trackData.uri
        ? trackData.uri.slice(trackData.uri.lastIndexOf('/') + 1)
        : 'MyTrack'

    // @ts-ignore
    const configuration = session.addTrackConf({
      trackId: `${fileName}-${Date.now()}`,
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

  return (
    <Container className={classes.importFormContainer}>
      {err ? <ErrorDisplay error={err} /> : null}
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
            <AssemblySelector
              selected={selected1}
              onChange={val => setSelected1(val)}
              session={session}
            />
            <AssemblySelector
              selected={selected2}
              onChange={val => setSelected2(val)}
              session={session}
            />
          </Paper>

          <Paper style={{ padding: 12 }}>
            <p style={{ textAlign: 'center' }}>
              <b>Optional</b>: Add a PAF{' '}
              <a href="https://github.com/lh3/miniasm/blob/master/PAF.md">
                (pairwise mapping format)
              </a>{' '}
              file for the dotplot view. Note that the first assembly should be
              the left column of the PAF and the second assembly should be the
              right column
            </p>
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
            disabled={!!err}
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
