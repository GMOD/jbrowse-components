import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { ClusterModeSelector } from '@jbrowse/tree-sidebar'
import { observer } from 'mobx-react'

import WiggleClusterDialogAuto from './WiggleClusterDialogAuto.tsx'
import WiggleClusterDialogManual from './WiggleClusterDialogManual.tsx'

import type { ReducedModel } from './types.ts'

const WiggleClusterDialog = observer(function WiggleClusterDialog({
  model,
  handleClose,
}: {
  model: ReducedModel
  handleClose: () => void
}) {
  const [activeMode, setActiveMode] = useState('auto')

  return (
    <Dialog
      open
      title="Cluster by score"
      maxWidth="xl"
      onClose={(_, reason) => {
        if (reason !== 'backdropClick') {
          handleClose()
        }
      }}
    >
      {activeMode === 'auto' ? (
        <WiggleClusterDialogAuto model={model} handleClose={handleClose}>
          <ClusterModeSelector value={activeMode} onChange={setActiveMode} />
        </WiggleClusterDialogAuto>
      ) : (
        <WiggleClusterDialogManual model={model} handleClose={handleClose}>
          <ClusterModeSelector value={activeMode} onChange={setActiveMode} />
        </WiggleClusterDialogManual>
      )}
    </Dialog>
  )
})

export default WiggleClusterDialog
