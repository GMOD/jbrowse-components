import {
  AssemblySelector,
  ErrorBanner,
  useAssemblySelection,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Container, Grid } from '@mui/material'
import { observer } from 'mobx-react'

import type { CircularViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(6),
  },
}))

const ImportForm = observer(function ImportForm({
  model,
}: {
  model: CircularViewModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const {
    selectedAssemblyName,
    setSelectedAssemblyName,
    assemblyError,
    regions,
  } = useAssemblySelection(session)

  const displayError = assemblyError ?? model.error

  return (
    <Container className={classes.importFormContainer}>
      {displayError ? <ErrorBanner error={displayError} /> : null}
      <Grid
        container
        spacing={1}
        sx={{ justifyContent: 'center', alignItems: 'center' }}
      >
        <AssemblySelector
          onChange={val => {
            model.setError(undefined)
            setSelectedAssemblyName(val)
          }}
          session={session}
          selected={selectedAssemblyName}
        />
        <Button
          disabled={!regions?.length}
          onClick={() => {
            model.setError(undefined)
            model.setDisplayedRegions(regions ?? [])
          }}
          variant="contained"
          color="primary"
        >
          {regions || displayError ? 'Open' : 'Loading...'}
        </Button>
      </Grid>
    </Container>
  )
})

export default ImportForm
