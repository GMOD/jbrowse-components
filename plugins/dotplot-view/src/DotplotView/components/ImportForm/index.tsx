import { useState } from 'react'

import { AssemblySelector, ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSyntenyTracks } from '@jbrowse/synteny-core'
import { Button, Container, Grid, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import TrackSelector from './TrackSelector.tsx'
import { doSubmit } from './doSubmit.ts'

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
  const firstAssembly = assemblyNames[0] ?? ''
  const [assemblyX, setAssemblyX] = useState(firstAssembly)
  const [assemblyY, setAssemblyY] = useState(firstAssembly)
  const [error, setError] = useState<unknown>()

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
            label="X-axis assembly"
            helperText=""
            selected={assemblyX}
            session={session}
            onChange={asm => {
              setAssemblyX(asm)
            }}
          />
          <AssemblySelector
            label="Y-axis assembly"
            helperText=""
            selected={assemblyY}
            session={session}
            onChange={asm => {
              setAssemblyY(asm)
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
          key={`${assemblyX}-${assemblyY}`}
          model={model}
          assemblyX={assemblyX}
          assemblyY={assemblyY}
          syntenyTracks={syntenyTracks}
        />
      </Paper>
    </Container>
  )
})

export default DotplotImportForm
