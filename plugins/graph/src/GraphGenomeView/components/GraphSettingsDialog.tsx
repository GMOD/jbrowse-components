import { Dialog } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Typography,
} from '@mui/material'
import Button from '@mui/material/Button'
import { observer } from 'mobx-react'

import { COLOR_SCHEME_OPTIONS } from './colorSchemes.ts'

import type { GraphGenomeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  section: {
    marginBottom: 24,
  },
  formControl: {
    minWidth: 200,
  },
})

const qualityLabels = ['Lowest', 'Low', 'Medium', 'High', 'Highest'] as const

const GraphSettingsDialog = observer(function GraphSettingsDialog(props: {
  model: GraphGenomeViewModel
  open: boolean
  onClose: () => void
}) {
  const { model, open, onClose } = props
  const { classes } = useStyles()

  return (
    <Dialog open={open} onClose={onClose} title="Graph settings">
      <DialogContent>
        <div className={classes.section}>
          <FormControl fullWidth>
            <FormLabel component="legend">Layout quality</FormLabel>
            <RadioGroup
              value={model.layoutQuality}
              onChange={e => {
                const quality = parseInt(e.target.value)
                model.setLayoutQuality(quality)
                void model.recomputeLayout()
              }}
            >
              {qualityLabels.map((label, i) => (
                <FormControlLabel
                  key={label}
                  value={i}
                  control={<Radio />}
                  label={label}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </div>

        <div className={classes.section}>
          <FormControlLabel
            control={
              <Switch
                checked={model.drawPaths}
                onChange={e => {
                  model.setDrawPaths(e.target.checked)
                }}
              />
            }
            label="Draw paths on edges"
          />
          <Typography variant="caption" color="text.secondary">
            Show the full path trajectories along edges
          </Typography>
        </div>

        <div className={classes.section}>
          <FormControl className={classes.formControl}>
            <InputLabel>Color scheme</InputLabel>
            <Select
              value={model.colorScheme}
              label="Color scheme"
              onChange={e => {
                model.setColorScheme(e.target.value)
              }}
            >
              {COLOR_SCHEME_OPTIONS.map(({ value, label }) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
      </DialogContent>

      <DialogActions>
        <Button variant="contained" color="primary" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default GraphSettingsDialog
