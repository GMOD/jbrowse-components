import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import {
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ClusterDialogAuto from './ClusterDialogAuto'
import ClusterDialogManual from './ClusterDialogManual'

import type { ReducedModel } from './types'

function Header({
  activeMode,
  samplesPerPixel,
  setActiveMode,
  setSamplesPerPixel,
}: {
  activeMode: string
  samplesPerPixel: string
  setActiveMode: (arg: string) => void
  setSamplesPerPixel: (arg: string) => void
}) {
  const error = !samplesPerPixel || Number.isNaN(+samplesPerPixel)
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
      <div style={{ marginTop: 20 }}>
        <Typography>
          This procedure samples the data at each 'pixel' across the visible by
          default
        </Typography>
        <TextField
          label="Samples per pixel"
          variant="outlined"
          size="small"
          value={samplesPerPixel}
          error={error}
          onChange={event => {
            setSamplesPerPixel(event.target.value)
          }}
          helperText={error ? 'Invalid number' : undefined}
        />
      </div>
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
  const [samplesPerPixel, setSamplesPerPixel] = useLocalStorage(
    'cluster-samplesPerPixel',
    '1',
  )
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
        <ClusterDialogAuto
          samplesPerPixel={+samplesPerPixel}
          model={model}
          handleClose={handleClose}
        >
          <Header
            samplesPerPixel={samplesPerPixel}
            setSamplesPerPixel={setSamplesPerPixel}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
          />
        </ClusterDialogAuto>
      ) : (
        <ClusterDialogManual
          samplesPerPixel={+samplesPerPixel}
          model={model}
          handleClose={handleClose}
        >
          <Header
            samplesPerPixel={samplesPerPixel}
            setSamplesPerPixel={setSamplesPerPixel}
            activeMode={activeMode}
            setActiveMode={setActiveMode}
          />
        </ClusterDialogManual>
      )}
    </Dialog>
  )
})

export default ClusterDialog
