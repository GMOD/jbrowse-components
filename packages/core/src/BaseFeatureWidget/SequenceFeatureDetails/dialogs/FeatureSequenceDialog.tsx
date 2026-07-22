import { useState } from 'react'

import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { Dialog, ErrorBanner, LoadingEllipses } from '../../../ui/index.ts'
import { makeStyles } from '../../../util/tss-react/index.ts'
import SequenceFeatureDetails from '../SequenceFeatureDetails.tsx'
import { SequenceFeatureDetailsF } from '../model.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '../../../util/index.ts'
import type { SequenceHoverTarget } from '../model.ts'

const useStyles = makeStyles()({
  dialogContent: {
    width: '80em',
  },
})

// The feature sequence panel as a standalone dialog, for callers that have a
// feature but no feature-detail widget open (e.g. a track's right-click menu).
// `feature` is optional so a caller still fetching the full feature -- the
// rendered track ships only slim arrays -- can mount the dialog immediately.
// The settings model lives for as long as the dialog does: it holds no
// snapshot and reads no tree, so nothing has to carry one around on the chance
// a sequence panel is opened.
const FeatureSequenceDialog = observer(function FeatureSequenceDialog({
  feature,
  error,
  session,
  assemblyName,
  hoverTarget,
  handleClose,
}: {
  feature: SimpleFeatureSerialized | undefined
  error?: unknown
  session: AbstractSessionModel
  assemblyName: string | undefined
  hoverTarget?: SequenceHoverTarget
  handleClose: () => void
}) {
  const { classes } = useStyles()
  const [model] = useState(() => SequenceFeatureDetailsF().create())

  return (
    <Dialog
      maxWidth="xl"
      open
      title={
        feature
          ? `Feature sequence - ${feature.name || feature.id || feature.type}`
          : 'Feature sequence'
      }
      onClose={() => {
        handleClose()
      }}
    >
      <DialogContent className={classes.dialogContent}>
        {error ? (
          <ErrorBanner error={error} />
        ) : feature ? (
          <SequenceFeatureDetails
            model={model}
            session={session}
            assemblyName={assemblyName}
            feature={feature}
            hoverTarget={hoverTarget}
            showOpenInDialog={false}
          />
        ) : (
          <LoadingEllipses message="Loading feature" />
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() => {
            handleClose()
          }}
          variant="contained"
          color="primary"
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default FeatureSequenceDialog
