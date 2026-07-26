import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ClusterModeSelector from '../ClusterModeSelector.tsx'
import ClusterAutoTab from './ClusterAutoTab.tsx'
import ClusterManualTab from './ClusterManualTab.tsx'

import type { ClusterDialogProps } from './types.ts'

function Header({
  activeMode,
  setActiveMode,
  description,
}: {
  activeMode: string
  setActiveMode: (arg: string) => void
  description?: string
}) {
  return (
    <ClusterModeSelector value={activeMode} onChange={setActiveMode}>
      {description ? (
        <Typography style={{ marginBottom: 30 }}>{description}</Typography>
      ) : null}
    </ClusterModeSelector>
  )
}

/**
 * The "Cluster rows by ..." dialog for every clusterable display. Two tabs (run
 * it in-app, or export an R script and paste the order back) over one
 * `ClusterDialogProps` describing what this display's matrix is and how to apply
 * an order to it. Each plugin used to carry its own copy of all three files.
 */
const ClusterDialog = observer(function ClusterDialog(
  props: ClusterDialogProps,
) {
  const { title, description, maxWidth, handleClose } = props
  const [activeMode, setActiveMode] = useState('auto')
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
        <ClusterAutoTab {...props}>
          <Header
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            description={description}
          />
        </ClusterAutoTab>
      ) : (
        <ClusterManualTab {...props}>
          <Header
            activeMode={activeMode}
            setActiveMode={setActiveMode}
            description={description}
          />
        </ClusterManualTab>
      )}
    </Dialog>
  )
})

export default ClusterDialog
