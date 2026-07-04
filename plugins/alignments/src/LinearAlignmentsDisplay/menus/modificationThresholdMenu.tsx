import { ModificationThresholdSlider } from './ModificationThresholdSlider.tsx'
import { DEFAULT_MODIFICATION_THRESHOLD } from '../../shared/types.ts'

import type { ColorBy } from '../../shared/types.ts'
import type { MenuItem } from '@jbrowse/core/ui'

interface ThresholdModel {
  modificationThreshold: number
  colorBy?: ColorBy
  setColorScheme: (colorBy: ColorBy) => void
}

// Drop any prior threshold, then re-add only a non-default value so a session
// left at the default doesn't carry a redundant field (mirrors modThresholdField
// in colorBy.ts).
function setModificationThreshold(model: ThresholdModel, threshold: number) {
  const currentColorBy = model.colorBy ?? { type: 'modifications' }
  const { threshold: _prev, ...restMods } = currentColorBy.modifications ?? {}
  model.setColorScheme({
    ...currentColorBy,
    modifications: {
      ...restMods,
      ...(threshold === DEFAULT_MODIFICATION_THRESHOLD ? {} : { threshold }),
    },
  })
}

// Inline slider (commits on release) replacing the former SetModificationThreshold
// dialog. Gates only the by-type modification radios above it — two-color (fixed
// 50% cutoff) and methylation (most-likely state) ignore it — so it sits under
// the by-type radios, not at the modifications top level.
export function makeModificationThresholdItem(model: ThresholdModel): MenuItem {
  return {
    label: 'Adjust threshold',
    type: 'custom',
    render: () => (
      <ModificationThresholdSlider
        initialValue={model.modificationThreshold}
        onCommit={v => {
          setModificationThreshold(model, v)
        }}
      />
    ),
  }
}
