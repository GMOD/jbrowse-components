import {
  AssemblySelector,
  ErrorBanner,
  useAssemblySelection,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  CircularProgress,
  Container,
  Grid,
  Typography,
} from '@mui/material'
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
    // keyed like the LGV form's, which is what the helper's localStorageKey is
    // for; without one the choice was re-picked as "whichever assembly sorts
    // first" on every reload. Its own key, not lgv's — the two forms open
    // different things and a user's last circle needn't be their last LGV.
  } = useAssemblySelection(session, 'circular')

  const displayError = assemblyError ?? model.error
  // Loaded, but the assembly has no regions to draw. Distinguished from "still
  // loading" (regions undefined) because both used to leave a disabled button
  // reading "Open" with nothing saying why it did nothing.
  const noRegions = !!regions && regions.length === 0

  return (
    <Container
      className={classes.importFormContainer}
      data-testid="import-form"
    >
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
        {/* the spinner sits beside the selector, where the LGV form puts its
          own — in the button it doubled as the label, so an assembly that
          loaded with zero regions read "Open" and did nothing when pressed */}
        {selectedAssemblyName && !displayError && !regions ? (
          <CircularProgress size={20} disableShrink />
        ) : null}
        <Button
          disabled={!regions?.length}
          onClick={() => {
            model.setError(undefined)
            model.setDisplayedRegions(regions ?? [])
          }}
          variant="contained"
          color="primary"
        >
          Open
        </Button>
      </Grid>
      {noRegions ? (
        <Typography variant="body2" color="warning.main">
          {selectedAssemblyName} has no regions to display.
        </Typography>
      ) : null}
    </Container>
  )
})

export default ImportForm
