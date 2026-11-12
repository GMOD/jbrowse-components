import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ClusterModeSelector from '../ClusterModeSelector.tsx'
import ClusterAutoTab from './ClusterAutoTab.tsx'
import ClusterManualTab from './ClusterManualTab.tsx'

import type { ClusterDialogProps } from './types.ts'

/**
 * The "Cluster rows by ..." dialog for every clusterable display. Two tabs (run
 * it in-app, or export an R script and paste the order back) over one
 * `ClusterDialogProps` describing what this display's matrix is. Either tab
 * lands its order through the display's `setRowOrder`.
 */
const ClusterDialog = observer(function ClusterDialog<
  S extends { name: string },
>(props: ClusterDialogProps<S>) {
  const { title, description, maxWidth, handleClose } = props
  const [activeMode, setActiveMode] = useState('auto')
  // One element, handed to whichever tab is up: the mode radios are the thing
  // that switches the tabs, so both tabs render the identical header and the
  // two spellings could only ever drift apart.
  const header = (
    <ClusterModeSelector value={activeMode} onChange={setActiveMode}>
      {description ? (
        <Typography style={{ marginBottom: 30 }}>{description}</Typography>
      ) : null}
    </ClusterModeSelector>
  )
  return (
    <Dialog
      open
      title={title}
      maxWidth={maxWidth}
      onClose={(_, reason) => {
        // don't close on backdrop click
        if (reason !== 'backdropClick') {
          handleClose()
        }
      }}
    >
      {activeMode === 'auto' ? (
        <ClusterAutoTab {...props}>{header}</ClusterAutoTab>
      ) : (
        <ClusterManualTab {...props}>{header}</ClusterManualTab>
      )}
    </Dialog>
  )
})

export default ClusterDialog
