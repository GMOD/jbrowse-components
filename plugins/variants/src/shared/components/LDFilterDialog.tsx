import { useState } from 'react'

import { NumberTextField } from '@jbrowse/core/ui'
import Dialog from '@jbrowse/core/ui/Dialog'
import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  FormControlLabel,
  Switch,
  Typography,
} from '@mui/material'

import type { FilterStats } from '../../VariantRPC/getLDMatrix.ts'

interface LDFilterModel {
  minorAlleleFrequencyFilter: number
  hweFilterThreshold: number
  callRateFilter: number
  filterStats?: FilterStats
  setMafFilter: (arg: number) => void
  setHweFilter: (arg: number) => void
  setCallRateFilter: (arg: number) => void
}

export default function LDFilterDialog({
  model,
  handleClose,
}: {
  model: LDFilterModel
  handleClose: () => void
}) {
  const {
    minorAlleleFrequencyFilter,
    hweFilterThreshold,
    callRateFilter,
    filterStats,
  } = model
  const [maf, setMaf] = useState<number | undefined>(minorAlleleFrequencyFilter)
  const [hweEnabled, setHweEnabled] = useState(hweFilterThreshold > 0)
  const [hweThreshold, setHweThreshold] = useState<number | undefined>(
    hweFilterThreshold > 0 ? hweFilterThreshold : 0.001,
  )
  const [callRateEnabled, setCallRateEnabled] = useState(callRateFilter > 0)
  const [callRate, setCallRate] = useState<number | undefined>(
    callRateFilter > 0 ? callRateFilter : 0.95,
  )

  const hasError =
    maf === undefined ||
    (hweEnabled && hweThreshold === undefined) ||
    (callRateEnabled && callRate === undefined)

  return (
    <Dialog
      open
      onClose={() => {
        handleClose()
      }}
      title="LD Filter Settings"
    >
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
              {filterStats.filteredByCallRate > 0 && (
                <li>Filtered by call rate: {filterStats.filteredByCallRate}</li>
              )}
            </Box>
          </Alert>
        ) : null}

        <Typography variant="subtitle1" gutterBottom>
          Minor Allele Frequency (MAF) Filter
        </Typography>
        <Typography variant="body2" color="text.secondary" component="p">
          Exclude variants with minor allele frequency below this threshold.
        </Typography>
        <NumberTextField
          defaultValue={minorAlleleFrequencyFilter}
          min={0}
          max={0.5}
          fullWidth
          size="small"
          label="MAF threshold (0-0.5)"
          errorText="MAF must be between 0 and 0.5"
          onValueChange={setMaf}
          style={{ marginBottom: 24 }}
        />

        <Typography variant="subtitle1" gutterBottom>
          Hardy-Weinberg Equilibrium (HWE) Filter
        </Typography>
        <Typography variant="body2" color="text.secondary" component="p">
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
          <NumberTextField
            defaultValue={hweThreshold}
            min={Number.MIN_VALUE}
            max={1}
            fullWidth
            size="small"
            label="P-value threshold"
            helperText="Variants with HWE p-value below this threshold are excluded (default: 0.001)"
            errorText="P-value must be between 0 (exclusive) and 1"
            onValueChange={setHweThreshold}
            style={{ marginTop: 8, marginBottom: 24 }}
          />
        ) : (
          <div style={{ marginBottom: 24 }} />
        )}

        <Typography variant="subtitle1" gutterBottom>
          Call Rate Filter
        </Typography>
        <Typography variant="body2" color="text.secondary" component="p">
          Exclude variants with too many missing genotypes. Call rate is the
          proportion of samples with non-missing genotype calls.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={callRateEnabled}
              onChange={e => {
                setCallRateEnabled(e.target.checked)
              }}
            />
          }
          label="Enable call rate filter"
        />
        {callRateEnabled ? (
          <NumberTextField
            defaultValue={callRate}
            min={0}
            max={1}
            fullWidth
            size="small"
            label="Minimum call rate (0-1)"
            helperText="Variants with call rate below this threshold are excluded (default: 0.95 = 95%)"
            errorText="Call rate must be between 0 and 1"
            onValueChange={setCallRate}
            style={{ marginTop: 8 }}
          />
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            handleClose()
          }}
          color="primary"
        >
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (maf !== undefined) {
              model.setMafFilter(maf)
            }
            model.setHweFilter(
              hweEnabled && hweThreshold !== undefined ? hweThreshold : 0,
            )
            model.setCallRateFilter(
              callRateEnabled && callRate !== undefined ? callRate : 0,
            )
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
