import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { observer } from 'mobx-react'

import WiggleClusterDialogAuto from './WiggleClusterDialogAuto.tsx'
import WiggleClusterDialogManual from './WiggleClusterDialogManual.tsx'

import type { ReducedModel } from './types.ts'

function Header({
  activeMode,
  setActiveMode,
}: {
  activeMode: string
  setActiveMode: (arg: string) => void
}) {
  return (
    <div>
      <RadioGroup>
        {Object.entries({
          auto: (
            <div>
              Run in-app clustering (slower, particularly for large numbers of
              samples, uses JS implementation of hclust)
            </div>
          ),
          manual: (
            <div>
              Download R script to run clustering (faster, uses R implementation
              of hclust)
            </div>
          ),
        }).map(([key, val]) => (
          <FormControlLabel
            key={key}
            control={
              <Radio
                checked={activeMode === key}
                onChange={() => {
                  setActiveMode(key)
                }}
              />
            }
            label={val}
          />
        ))}
      </RadioGroup>
    </div>
  )
}

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
        // don't close on backdrop click
        if (reason !== 'backdropClick') {
          handleClose()
        }
      }}
    >
      {activeMode === 'auto' ? (
        <WiggleClusterDialogAuto model={model} handleClose={handleClose}>
          <Header activeMode={activeMode} setActiveMode={setActiveMode} />
        </WiggleClusterDialogAuto>
      ) : (
        <WiggleClusterDialogManual model={model} handleClose={handleClose}>
          <Header activeMode={activeMode} setActiveMode={setActiveMode} />
        </WiggleClusterDialogManual>
      )}
    </Dialog>
  )
})

export default WiggleClusterDialog
