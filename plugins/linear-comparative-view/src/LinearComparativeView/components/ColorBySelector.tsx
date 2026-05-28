import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const COLOR_MODES = [
  {
    label: 'Default',
    value: 'default',
    helpText:
      'Use the default color scheme with CIGAR operation coloring. Insertions, deletions, matches, and mismatches are shown in different colors with transparency.',
  },
  {
    label: 'Strand',
    value: 'strand',
    helpText:
      'Color alignments by strand orientation. Forward strand alignments and reverse strand alignments are shown in different colors, making it easy to identify inversions and strand-specific patterns.',
  },
  {
    label: 'Query',
    value: 'query',
    helpText:
      'Color alignments by query sequence name. Each unique query sequence is assigned a consistent color based on its name, making it easy to visually distinguish between different sequences.',
  },
  {
    label: 'Identity',
    value: 'identity',
    helpText:
      'Color alignments by sequence identity percentage. Higher identity matches appear in warmer colors, lower identity matches appear cooler. Useful for identifying highly conserved vs divergent regions.',
  },
  {
    label: 'Mean query identity',
    value: 'meanQueryIdentity',
    helpText:
      'Color alignments by the length-weighted mean identity across each query/target pair. Aggregates noise from local variations, giving a smoothed view of overall alignment quality across a query contig.',
  },
  {
    label: 'Mapping quality',
    value: 'mappingQuality',
    helpText:
      'Color alignments by mapping quality (PAF MAPQ). Higher quality (more confident) mappings appear in warmer colors. Useful for identifying ambiguous or multi-mapping regions.',
  },
] as const

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { colorBy } = model

  return (
    <CascadingMenuButton
      menuItems={COLOR_MODES.map(({ label, value, helpText }) => ({
        label,
        type: 'radio',
        checked: colorBy === value,
        helpText,
        onClick: () => {
          model.setColorBy(value)
        },
      }))}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
