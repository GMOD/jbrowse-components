import React, { useState } from 'react'
import { Button, Paper, Container, Grid, makeStyles } from '@material-ui/core'
import { FileSelector } from '@jbrowse/core/ui'
import { FileLocation } from '@jbrowse/core/util/types'
import { observer } from 'mobx-react'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import { DotplotViewModel } from '../model'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
}))

const DotplotImportForm = observer(({ model }: { model: DotplotViewModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const [trackData, setTrackData] = useState<FileLocation>()
  const [selected1, setSelected1] = useState(assemblyNames[0])
  const [selected2, setSelected2] = useState(assemblyNames[0])
  const selected = [selected1, selected2]
  const [error, setError] = useState<unknown>()

  const assemblyError = assemblyNames.length
    ? selected
        .map(a => assemblyManager.get(a)?.error)
        .filter(f => !!f)
        .join(', ')
    : 'No configured assemblies'

  function onOpenClick() {
    try {
      if (!isSessionWithAddTracks(session)) {
        return
      }
      model.setViews([
        { bpPerPx: 0.1, offsetPx: 0 },
        { bpPerPx: 0.1, offsetPx: 0 },
      ])
      model.setAssemblyNames([selected1, selected2])

      const fileName =
        trackData && 'uri' in trackData && trackData.uri
          ? trackData.uri.slice(trackData.uri.lastIndexOf('/') + 1)
          : 'MyTrack'

      const trackId = `${fileName}-${Date.now()}`

      session.addTrackConf({
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
      model.toggleTrack(trackId)
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
                  description=""
                  location={trackData}
                  setLocation={loc => setTrackData(loc)}
                  session={session}
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
