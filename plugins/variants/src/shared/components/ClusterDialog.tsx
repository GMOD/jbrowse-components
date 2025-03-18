import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ClusterDialogAuto from './ClusterDialogAuto'
import ClusterDialogManual from './ClusterDialogManual'

import type { Source } from '../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

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
              Run in-app clustering (slow for large data, built in JS
              clustering)
            </div>
          ),
          manual: (
            <div>
              Download R script to run clustering (faster for large data, uses
              hclust, may be more accurate)
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
  model: {
    sourcesWithoutLayout?: Source[]
    minorAlleleFrequencyFilter?: number
    adapterConfig: AnyConfigurationModel
    setLayout: (arg: Source[]) => void
    clearLayout: () => void
  }
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
