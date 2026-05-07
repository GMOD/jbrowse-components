import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { colorBy } = model

  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Default',
          type: 'radio',
          checked: colorBy === 'default',
          onClick: () => {
            model.setColorBy('default')
          },
          helpText:
            'Use the default color scheme with CIGAR operation coloring. Insertions, deletions, matches, and mismatches are shown in different colors with transparency.',
        },
        {
          label: 'Strand',
          type: 'radio',
          checked: colorBy === 'strand',
          onClick: () => {
            model.setColorBy('strand')
          },
          helpText:
            'Color alignments by strand orientation. Forward strand alignments and reverse strand alignments are shown in different colors, making it easy to identify inversions and strand-specific patterns.',
        },
        {
          label: 'Query',
          type: 'radio',
          checked: colorBy === 'query',
          onClick: () => {
            model.setColorBy('query')
          },
          helpText:
            'Color alignments by query sequence name. Each unique query sequence is assigned a consistent color based on its name, making it easy to visually distinguish between different sequences.',
        },
        {
          label: 'SyRI (structural)',
          type: 'radio',
          checked: colorBy === 'syri',
          onClick: () => {
            model.setColorBy('syri')
          },
          helpText:
            'Color alignments by structural variant type using SyRI-style classification: syntenic (gray), inversions (orange), translocations (yellow-green), and duplications (cyan). Colors match plotsr defaults.',
        },
      ]}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
