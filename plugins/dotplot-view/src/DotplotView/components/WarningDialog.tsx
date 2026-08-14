import { TrackWarningsDialog } from '@jbrowse/synteny-core'
import { DialogContentText } from '@mui/material'

import type { TrackWarning } from '@jbrowse/synteny-core'

// The dotplot's binding of the shared render-warnings report: the rows are
// already flattened to (track name, its warnings) by the model, which is what
// knows how to reach a display's warnings — see `DotplotView.trackWarnings`.
export default function WarningDialog({
  trackWarnings,
  handleClose,
}: {
  handleClose: () => void
  trackWarnings: TrackWarning[]
}) {
  return (
    <TrackWarningsDialog
      trackWarnings={trackWarnings}
      title="Dotplot rendered with warnings"
      handleClose={handleClose}
    >
      <DialogContentText>
        Found warnings while rendering the dotplot. This is often due to
        out-of-bound features that may indicate the wrong assemblies are being
        used. Check that the query and target are configured correctly, and that
        the right assemblies are being compared.
      </DialogContentText>
    </TrackWarningsDialog>
  )
}
