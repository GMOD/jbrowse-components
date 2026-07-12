import { makeSizeMenu } from '@jbrowse/core/ui'

import {
  DEFAULT_MODIFICATION_THRESHOLD,
  modificationThresholdField,
} from '../../shared/types.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ThresholdModel {
  modificationThreshold: number
  colorBy?: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

// Drop any prior threshold, then re-add only a non-default value (via the shared
// modificationThresholdField rule) so a session left at the default doesn't
// carry a redundant field.
function setModificationThreshold(model: ThresholdModel, threshold: number) {
  const currentColorBy = model.colorBy ?? { type: 'modifications' }
  const { threshold: _prev, ...restMods } = currentColorBy.modifications ?? {}
  model.setColorScheme({
    ...currentColorBy,
    modifications: { ...restMods, ...modificationThresholdField(threshold) },
  })
}

// Inline slider matching the shared size-slider rows (wiggle point size, etc.),
// but commits on release: the threshold flows through rpcProps into the worker's
// extractModifications (tier-1 refetch), so a live onChange would fire a refetch
// on every intermediate pixel. Gates only the by-type modification radios above
// it — two-color (fixed 50% cutoff) and methylation (most-likely state) ignore
// it — so it sits under the by-type radios, not at the modifications top level.
export function makeModificationThresholdItem(model: ThresholdModel): MenuItem {
  return makeSizeMenu({
    label: 'Adjust threshold',
    title: 'Threshold',
    min: 0,
    max: 100,
    step: 1,
    unit: '%',
    commitOnRelease: true,
    getValue: () => model.modificationThreshold,
    isDefault: model.modificationThreshold === DEFAULT_MODIFICATION_THRESHOLD,
    onChange: v => {
      setModificationThreshold(model, v)
    },
    onReset: () => {
      setModificationThreshold(model, DEFAULT_MODIFICATION_THRESHOLD)
    },
  })
}
