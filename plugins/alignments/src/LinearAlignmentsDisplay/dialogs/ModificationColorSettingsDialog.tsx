import { Dialog, SingleSlider } from '@jbrowse/core/ui'
import {
  Button,
  DialogActions,
  DialogContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  cytosineContextOptions,
  modificationData,
} from '../../shared/modificationData.ts'
import { DEFAULT_MODIFICATION_THRESHOLD } from '../../shared/types.ts'

import type { ModificationColorBy } from '../../shared/types.ts'
import type { ModificationsModel } from '../menus/colorBy.ts'

function currentMods(model: ModificationsModel): ModificationColorBy {
  return model.colorBy.type === 'modifications'
    ? (model.colorBy.modifications ?? {})
    : {}
}

// Rewrite one refinement while preserving the active view (twoColor /
// fillUnmarked) and every other refinement, dropping any field left at its
// default so a saved session never carries redundant state.
function updateMods(
  model: ModificationsModel,
  next: Partial<ModificationColorBy>,
) {
  const merged = { ...currentMods(model), ...next }
  model.setColorScheme({
    type: 'modifications',
    modifications: {
      ...(merged.twoColor ? { twoColor: true } : {}),
      ...(merged.fillUnmarked ? { fillUnmarked: true } : {}),
      ...(merged.shownModifications?.length
        ? { shownModifications: merged.shownModifications }
        : {}),
      ...(merged.hiddenModifications?.length
        ? { hiddenModifications: merged.hiddenModifications }
        : {}),
      ...(merged.threshold !== undefined &&
      merged.threshold !== DEFAULT_MODIFICATION_THRESHOLD
        ? { threshold: merged.threshold }
        : {}),
      ...(merged.cytosineContext && merged.cytosineContext !== 'CG'
        ? { cytosineContext: merged.cytosineContext }
        : {}),
    },
  })
}

const ModificationColorSettingsDialog = observer(
  function ModificationColorSettingsDialog({
    model,
    handleClose,
  }: {
    model: ModificationsModel
    handleClose: () => void
  }) {
    const mods = currentMods(model)
    const context = mods.cytosineContext ?? 'CG'
    const threshold = model.modificationThreshold
    const types = model.visibleModificationTypes
    const shown = mods.shownModifications
    const showValue = shown?.length === 1 ? shown[0] : 'all'

    return (
      <Dialog
        open
        onClose={() => {
          handleClose()
        }}
        title="Modification color settings"
        maxWidth="xs"
        fullWidth
      >
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <FormLabel>Minimum probability threshold: {threshold}%</FormLabel>
            <Typography variant="caption" color="textSecondary">
              Hides low-confidence calls. Applies to the &ldquo;Color by
              type&rdquo; view (probability and methylation views paint every
              call).
            </Typography>
            <SingleSlider
              min={0}
              max={100}
              step={1}
              value={threshold}
              valueLabelDisplay="auto"
              onChangeCommitted={v => {
                updateMods(model, { threshold: v })
              }}
            />
          </FormControl>

          <FormControl fullWidth margin="normal">
            <FormLabel>Cytosine context</FormLabel>
            <Typography variant="caption" color="textSecondary">
              Which cytosines count when filling unmarked sites (the methylation
              view). Plants use CHG/CHH.
            </Typography>
            <Select
              size="small"
              value={context}
              onChange={e => {
                const next = cytosineContextOptions.find(
                  o => o.value === e.target.value,
                )?.value
                if (next) {
                  updateMods(model, { cytosineContext: next })
                }
              }}
            >
              {cytosineContextOptions.map(o => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {types.length > 1 ? (
            <FormControl fullWidth margin="normal">
              <FormLabel>Show modification types</FormLabel>
              <Typography variant="caption" color="textSecondary">
                Limit which types are drawn in the by-type and probability
                views.
              </Typography>
              <RadioGroup
                value={showValue}
                onChange={e => {
                  updateMods(model, {
                    shownModifications:
                      e.target.value === 'all' ? undefined : [e.target.value],
                  })
                }}
              >
                <FormControlLabel
                  value="all"
                  control={<Radio />}
                  label="All detected types"
                />
                {types.map(t => (
                  <FormControlLabel
                    key={t}
                    value={t}
                    control={<Radio />}
                    label={modificationData[t]?.name ?? t}
                  />
                ))}
              </RadioGroup>
            </FormControl>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              handleClose()
            }}
            variant="contained"
            color="primary"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default ModificationColorSettingsDialog
