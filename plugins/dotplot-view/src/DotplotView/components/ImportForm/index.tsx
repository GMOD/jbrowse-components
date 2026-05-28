import { useState } from 'react'

import { AssemblySelector, ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSyntenyTracks } from '@jbrowse/synteny-core'
import { Button, Container, Grid, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelector from './TrackSelector.tsx'
import { doSubmit, resolveImportFormSelection } from './doSubmit.ts'

import type { DotplotViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
    margin: '0 auto',
  },
}))

const DotplotImportForm = observer(function DotplotImportForm({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames } = session
  const [assemblyX, setAssemblyX] = useState(assemblyNames[0] ?? '')
  const [assemblyY, setAssemblyY] = useState(assemblyNames[0] ?? '')
  const [error, setError] = useState<unknown>()
  const [choice, setChoice] = useState('tracklist')
  const [preConfiguredTrackId, setPreConfiguredTrackId] = useState('')

  const syntenyTracks = getSyntenyTracks(session.tracks, [assemblyX, assemblyY])
  const displayError = error ?? model.error

  return (
    <Container className={classes.importFormContainer}>
      {displayError ? <ErrorBanner error={displayError} /> : null}

      <Paper style={{ padding: 12 }}>
        <Typography style={{ textAlign: 'center' }}>
          Select assemblies for dotplot view
        </Typography>
        <Grid
          container
          spacing={1}
          sx={{ justifyContent: 'center', alignItems: 'center' }}
        >
          <AssemblySelector
            helperText="x-axis assembly"
            selected={assemblyX}
            session={session}
            onChange={asm => {
              setAssemblyX(asm)
              setPreConfiguredTrackId('')
            }}
          />
          <AssemblySelector
            helperText="y-axis assembly"
            selected={assemblyY}
            session={session}
            onChange={asm => {
              setAssemblyY(asm)
              setPreConfiguredTrackId('')
            }}
          />
          <Button
            onClick={() => {
              try {
                setError(undefined)
                doSubmit({
                  model,
                  session,
                  assemblyX,
                  assemblyY,
                  selection: resolveImportFormSelection({
                    choice,
                    preConfiguredTrackId,
                    syntenyTracks,
                    modelSelection: model.importFormSyntenyTrackSelections[0],
                  }),
                })
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
            variant="contained"
            color="primary"
          >
            Launch
          </Button>
        </Grid>
        <TrackSelector
          model={model}
          assemblyX={assemblyX}
          assemblyY={assemblyY}
          syntenyTracks={syntenyTracks}
          choice={choice}
          setChoice={setChoice}
          preConfiguredTrackId={preConfiguredTrackId}
          setPreConfiguredTrackId={setPreConfiguredTrackId}
        />
      </Paper>
    </Container>
  )
})

export default DotplotImportForm
