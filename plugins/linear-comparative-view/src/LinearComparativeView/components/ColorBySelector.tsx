import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model'
import type { LinearComparativeViewModel } from '../model'

const ColorBySelector = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  // Get the first display from the first level (if it exists)
  const firstDisplay = model.levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const colorBy = firstDisplay?.colorBy ?? 'default'

  const setColorBy = (value: string) => {
    // Set colorBy for all displays across all levels
    for (const level of model.levels) {
      for (const track of level.tracks) {
        for (const display of track.displays) {
          ;(display as LinearSyntenyDisplayModel).setColorBy(value)
        }
      }
    }
  }

  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Default',
          type: 'radio',
          checked: colorBy === 'default',
          onClick: () => { setColorBy('default') },
          helpText:
            'Use the default color scheme with CIGAR operation coloring. Insertions, deletions, matches, and mismatches are shown in different colors with transparency.',
        },
        {
          label: 'Strand',
          type: 'radio',
          checked: colorBy === 'strand',
          onClick: () => { setColorBy('strand') },
          helpText:
            'Color alignments by strand orientation. Forward strand alignments and reverse strand alignments are shown in different colors, making it easy to identify inversions and strand-specific patterns.',
        },
      ]}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
