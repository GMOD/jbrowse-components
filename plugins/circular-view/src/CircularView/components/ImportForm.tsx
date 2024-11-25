import React, { useState } from 'react'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button, Container, Grid } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { CircularViewModel } from '../models/model'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(6),
  },
}))

const ImportForm = observer(function ({ model }: { model: CircularViewModel }) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { error } = model
  const { assemblyNames, assemblyManager } = session
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0]!)
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
              model.setError(undefined)
              setSelectedAsm(val)
            }}
            session={session}
            selected={selectedAsm}
          />
        </Grid>

        <Grid item>
          <Button
            disabled={!regions.length}
            onClick={() => {
              model.setError(undefined)
              model.setDisplayedRegions(regions)
            }}
            variant="contained"
            color="primary"
          >
            {/* if there's an error, it's not actively loading  so just display open */}
            {regions.length || err ? 'Open' : 'Loading...'}
          </Button>
        </Grid>
      </Grid>
    </Container>
  )
})

export default ImportForm
