import { useState } from 'react'

import Dialog from '@jbrowse/core/ui/Dialog'
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material'

import type { FilterStats } from '../../VariantRPC/getLDMatrix.ts'

export default function LDFilterDialog({
  model,
  handleClose,
}: {
  model: {
    minorAlleleFrequencyFilter: number
    hweFilterThreshold: number
    filterStats?: FilterStats
    setMafFilter: (arg: number) => void
    setHweFilter: (arg: number) => void
  }
  handleClose: () => void
}) {
  const { minorAlleleFrequencyFilter, hweFilterThreshold, filterStats } = model
  const [maf, setMaf] = useState(`${minorAlleleFrequencyFilter}`)
  const [hweEnabled, setHweEnabled] = useState(hweFilterThreshold > 0)
  const [hweThreshold, setHweThreshold] = useState(
    hweFilterThreshold > 0 ? `${hweFilterThreshold}` : '0.001',
  )
  const [mafError, setMafError] = useState<string>()
  const [hweError, setHweError] = useState<string>()

  const validateMaf = (val: string) => {
    const num = Number.parseFloat(val)
    if (Number.isNaN(num)) {
      setMafError('Please enter a valid number')
      return false
    }
    if (num < 0 || num > 0.5) {
      setMafError('MAF must be between 0 and 0.5')
      return false
    }
    setMafError(undefined)
    return true
  }

  const validateHwe = (val: string) => {
    const num = Number.parseFloat(val)
    if (Number.isNaN(num)) {
      setHweError('Please enter a valid number')
      return false
    }
    if (num <= 0 || num > 1) {
      setHweError('P-value must be between 0 and 1')
      return false
    }
    setHweError(undefined)
    return true
  }

  const hasError = !!mafError || (hweEnabled && !!hweError)

  return (
    <Dialog open onClose={handleClose} title="LD Filter Settings">
      <DialogContent style={{ width: 500 }}>
        {filterStats ? (
          <Alert severity="info" style={{ marginBottom: 16 }}>
            <Typography variant="subtitle2" gutterBottom>
              Filter Statistics
            </Typography>
            <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
              <li>Total variants in region: {filterStats.totalVariants}</li>
              <li>Passed all filters: {filterStats.passedVariants}</li>
              {filterStats.filteredByMaf > 0 && (
                <li>Filtered by MAF: {filterStats.filteredByMaf}</li>
              )}
              {filterStats.filteredByLength > 0 && (
                <li>Filtered by length: {filterStats.filteredByLength}</li>
              )}
              {filterStats.filteredByMultiallelic > 0 && (
                <li>
                  Filtered by multiallelic: {filterStats.filteredByMultiallelic}
                </li>
              )}
              {filterStats.filteredByHwe > 0 && (
                <li>Filtered by HWE: {filterStats.filteredByHwe}</li>
              )}
            </Box>
          </Alert>
        ) : null}

        <Typography variant="subtitle1" gutterBottom>
          Minor Allele Frequency (MAF) Filter
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Exclude variants with minor allele frequency below this threshold.
        </Typography>
        <TextField
          value={maf}
          fullWidth
          size="small"
          label="MAF threshold (0-0.5)"
          error={!!mafError}
          helperText={mafError}
          onChange={event => {
            const val = event.target.value
            setMaf(val)
            validateMaf(val)
          }}
          style={{ marginBottom: 24 }}
        />

        <Typography variant="subtitle1" gutterBottom>
          Hardy-Weinberg Equilibrium (HWE) Filter
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Exclude variants that deviate significantly from HWE, which may
          indicate genotyping errors or population stratification. This follows
          Haploview&apos;s approach.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={hweEnabled}
              onChange={e => {
                setHweEnabled(e.target.checked)
              }}
            />
          }
          label="Enable HWE filter"
        />
        {hweEnabled ? (
          <TextField
            value={hweThreshold}
            fullWidth
            size="small"
            label="P-value threshold"
            error={!!hweError}
            helperText={
              hweError ||
              'Variants with HWE p-value below this threshold are excluded (default: 0.001)'
            }
            onChange={event => {
              const val = event.target.value
              setHweThreshold(val)
              validateHwe(val)
            }}
            style={{ marginTop: 8 }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
        <Button
          onClick={() => {
            const mafVal = Number.parseFloat(maf)
            if (!Number.isNaN(mafVal) && mafVal >= 0 && mafVal <= 0.5) {
              model.setMafFilter(mafVal)
            }
            if (hweEnabled) {
              const hweVal = Number.parseFloat(hweThreshold)
              if (!Number.isNaN(hweVal) && hweVal > 0 && hweVal <= 1) {
                model.setHweFilter(hweVal)
              }
            } else {
              model.setHweFilter(0) // Disable HWE filter
            }
            handleClose()
          }}
          color="primary"
          variant="contained"
          disabled={hasError}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  )
}
