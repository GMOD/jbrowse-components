import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { modificationData } from '../modificationData.ts'

import type { ColorBy } from '../types.ts'

const ModificationSettingsDialog = observer(
  function ModificationSettingsDialog(props: {
    model: {
      modificationThreshold: number
      visibleModificationTypes: string[]
      colorBy?: ColorBy
      setColorScheme: (colorBy: ColorBy) => void
    }
    handleClose: () => void
  }) {
    const { model, handleClose } = props
    const currentMods = model.colorBy?.modifications
    const [threshold, setThreshold] = useState(
      String(model.modificationThreshold),
    )
    const [twoColor, setTwoColor] = useState(!!currentMods?.twoColor)
    const [isolatedModification, setIsolatedModification] = useState(
      currentMods?.isolatedModification ?? '',
    )

    const numThreshold = Number.parseFloat(threshold)
    const validThreshold =
      !Number.isNaN(numThreshold) && numThreshold >= 0 && numThreshold <= 100

    return (
      <Dialog open onClose={handleClose} title="Modification settings">
        <DialogContent>
          <TextField
            value={threshold}
            onChange={event => {
              setThreshold(event.target.value)
            }}
            label="Probability threshold (%)"
            helperText={
              threshold !== '' && !validThreshold
                ? 'Must be a number between 0 and 100'
                : 'Only show modifications above this probability'
            }
            error={threshold !== '' && !validThreshold}
            autoComplete="off"
            type="number"
            fullWidth
            margin="dense"
            slotProps={{
              htmlInput: {
                min: 0,
                max: 100,
                step: 1,
              },
            }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={twoColor}
                onChange={() => {
                  setTwoColor(val => !val)
                }}
              />
            }
            label="Color <50% probability blue (two-color mode)"
          />
          {model.visibleModificationTypes.length > 0 ? (
            <TextField
              select
              value={isolatedModification}
              onChange={event => {
                setIsolatedModification(event.target.value)
              }}
              label="Show modification type"
              fullWidth
              margin="dense"
            >
              <MenuItem value="">All modifications</MenuItem>
              {model.visibleModificationTypes.map(key => (
                <MenuItem key={key} value={key}>
                  {modificationData[key]?.name || key}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Typography color="textSecondary" sx={{ mt: 1 }}>
              No modifications currently detected
            </Typography>
          )}
          <DialogActions>
            <Button
              variant="contained"
              color="primary"
              type="submit"
              autoFocus
              disabled={!validThreshold}
              onClick={() => {
                const colorByType = model.colorBy?.type ?? 'modifications'
                const type =
                  colorByType === 'modifications' ||
                  colorByType === 'methylation'
                    ? colorByType
                    : 'modifications'
                model.setColorScheme({
                  type,
                  modifications: {
                    threshold: numThreshold,
                    twoColor: twoColor || undefined,
                    isolatedModification: isolatedModification || undefined,
                  },
                })
                handleClose()
              }}
            >
              Submit
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                handleClose()
              }}
            >
              Cancel
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    )
  },
)

export default ModificationSettingsDialog
