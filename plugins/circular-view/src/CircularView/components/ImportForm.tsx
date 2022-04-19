import React, { useState } from 'react'
import { Button, Container, Grid } from '@mui/material'
import { makeStyles } from '@mui/styles'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    marginBottom: theme.spacing(4),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ImportForm = observer(({ model }: { model: any }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { error: modelError } = model
  const { assemblyNames, assemblyManager } = session
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0])
  const [error, setError] = useState<Error | undefined>(modelError)
  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const err = assemblyError || error

  return (
    <Container className={classes.importFormContainer}>
      {err ? (
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <Grid item>
            <ErrorMessage error={err} />
          </Grid>
        </Grid>
      ) : null}
      <Grid container spacing={1} justifyContent="center" alignItems="center">
        <Grid item>
          <AssemblySelector
            onChange={val => {
              setError(undefined)
              setSelectedAsm(val)
            }}
            session={session}
            selected={selectedAsm}
          />
        </Grid>

        <Grid item>
          <Button
            disabled={!regions?.length}
            onClick={() => model.setDisplayedRegions(regions)}
            variant="contained"
            color="primary"
          >
            {regions.length ? 'Open' : 'Loading…'}
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

export default ImportForm
