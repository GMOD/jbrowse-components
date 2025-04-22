import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ClusterDialogAuto from './ClusterDialogAuto'
import ClusterDialogManual from './ClusterDialogManual'

import type { ReducedModel } from './types'

function Header({
  activeMode,
  setActiveMode,
}: {
  activeMode: string
  setActiveMode: (arg: string) => void
}) {
  return (
    <div>
      <Typography style={{ marginBottom: 30 }}>
        This procedure will cluster the visible genotype data using hierarchical
        clustering
      </Typography>

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

const ClusterDialog = observer(function ({
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
      title="Cluster by genotype"
      onClose={(_, reason) => {
        // don't close on backdrop click
        if (reason !== 'backdropClick') {
          handleClose()
        }
      }}
    >
      {activeMode === 'auto' ? (
        <ClusterDialogAuto model={model} handleClose={handleClose}>
          <Header activeMode={activeMode} setActiveMode={setActiveMode} />
        </ClusterDialogAuto>
      ) : (
        <ClusterDialogManual model={model} handleClose={handleClose}>
          <Header activeMode={activeMode} setActiveMode={setActiveMode} />
        </ClusterDialogManual>
      )}
    </Dialog>
  )
})

export default ClusterDialog
