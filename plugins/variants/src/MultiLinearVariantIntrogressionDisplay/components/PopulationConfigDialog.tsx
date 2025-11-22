import { useState, useEffect } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Chip,
  Box,
  Typography,
  Switch,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { MultiLinearVariantIntrogressionDisplayModel } from '../model'

const PopulationConfigDialog = observer(function ({
  model,
  handleClose,
}: {
  model: MultiLinearVariantIntrogressionDisplayModel
  handleClose: () => void
}) {
  const [P1, setP1] = useState<string[]>(model.populations.P1)
  const [P2, setP2] = useState<string[]>(model.populations.P2)
  const [P3, setP3] = useState<string[]>(model.populations.P3)
  const [outgroup, setOutgroup] = useState<string[]>(
    model.populations.outgroup,
  )
  const [autoAssign, setAutoAssign] = useState(model.autoAssignFromClustering)

  const allSamples = model.layout.map(s => s.name)

  const assignedSamples = new Set([...P1, ...P2, ...P3, ...outgroup])
  const availableSamples = allSamples.filter(s => !assignedSamples.has(s))

  useEffect(() => {
    if (autoAssign && model.root) {
      model.autoAssignPopulationsFromTree()
      setP1(model.populations.P1)
      setP2(model.populations.P2)
      setP3(model.populations.P3)
      setOutgroup(model.populations.outgroup)
    }
  }, [autoAssign, model])

  const handleSave = () => {
    model.setPopulations({ P1, P2, P3, outgroup })
    model.setAutoAssignFromClustering(autoAssign)
    model.calculateIntrogression()
    handleClose()
  }

  const renderPopulationSelect = (
    label: string,
    value: string[],
    setValue: (val: string[]) => void,
    color: string,
  ) => (
    <FormControl fullWidth sx={{ mb: 2 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple
        value={value}
        label={label}
        onChange={e => setValue(e.target.value as string[])}
        disabled={autoAssign}
        renderValue={selected => (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {(selected as string[]).map(s => (
              <Chip
                key={s}
                label={s}
                size="small"
                sx={{ backgroundColor: color }}
              />
            ))}
          </Box>
        )}
      >
        {[...availableSamples, ...value].map(sample => (
          <MenuItem key={sample} value={sample}>
            {sample}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )

  return (
    <Dialog open onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Configure Populations for Introgression Analysis</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={autoAssign}
                onChange={e => setAutoAssign(e.target.checked)}
                disabled={!model.root}
              />
            }
            label="Auto-assign from clustering tree"
          />
          {!model.root && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 4 }}>
              Run clustering first to enable auto-assignment
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            For ABBA-BABA analysis: ((P1,P2),P3,Outgroup)
            <br />
            Introgression from P3 into P2 gives positive D-statistic
          </Typography>

          {renderPopulationSelect('P1 (Population 1)', P1, setP1, '#4caf50')}
          {renderPopulationSelect('P2 (Population 2)', P2, setP2, '#2196f3')}
          {renderPopulationSelect('P3 (Population 3)', P3, setP3, '#ff9800')}
          {renderPopulationSelect('Outgroup', outgroup, setOutgroup, '#9c27b0')}

          {availableSamples.length > 0 && !autoAssign && (
            <Typography variant="caption" color="warning.main">
              {availableSamples.length} unassigned sample(s):{' '}
              {availableSamples.join(', ')}
            </Typography>
          )}
        </Box>

        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Summary
          </Typography>
          <Typography variant="body2">
            P1: {P1.length} samples
            <br />
            P2: {P2.length} samples
            <br />
            P3: {P3.length} samples
            <br />
            Outgroup: {outgroup.length} samples
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={
            P1.length === 0 ||
            P2.length === 0 ||
            P3.length === 0 ||
            outgroup.length === 0
          }
        >
          Calculate Introgression
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default PopulationConfigDialog
