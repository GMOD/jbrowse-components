import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const COLOR_BY_OPTIONS = [
  {
    value: 'default',
    label: 'Default',
    helpText:
      'Use the default color scheme specified in the track configuration. This respects the color settings defined in the config file.',
  },
  {
    value: 'identity',
    label: 'Identity',
    helpText:
      'Color alignments by sequence identity percentage. Higher identity matches appear in warmer colors, while lower identity matches appear cooler. Useful for identifying highly conserved vs. divergent regions.',
  },
  {
    value: 'meanQueryIdentity',
    label: 'Mean query identity',
    helpText:
      'Color alignments based on the mean identity across the query sequence. This provides a smoothed view of overall alignment quality, reducing noise from local variations. For instance, a single long query of e.g. a contig of an assembly, when aligned to the target, may get split into many smaller "hits". This score aggregates across them, and colors them all the same. Similar code exists in the program dotPlotly',
  },
  {
    value: 'mappingQuality',
    label: 'Mapping quality',
    helpText:
      'Color alignments by mapping quality score (MAPQ). Higher quality mappings (more unique/confident) appear in darker colors. Useful for identifying ambiguous or multi-mapping regions.',
  },
  {
    value: 'strand',
    label: 'Strand',
    helpText:
      'Color alignments by strand orientation. Forward strand alignments and reverse strand alignments are shown in different colors, making it easy to identify inversions and strand-specific patterns.',
  },
  {
    value: 'query',
    label: 'Query',
    helpText:
      'Color alignments by query sequence name. Each unique query sequence is assigned a consistent color based on its name, making it easy to visually distinguish between different sequences.',
  },
] as const

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: DotplotViewModel
}) {
  const { dotplotDisplays } = model
  const colorBy = dotplotDisplays[0]?.colorBy ?? 'default'

  return (
    <CascadingMenuButton
      menuItems={COLOR_BY_OPTIONS.map(opt => ({
        label: opt.label,
        type: 'radio' as const,
        checked: colorBy === opt.value,
        onClick: () => {
          for (const d of dotplotDisplays) {
            d.setColorBy(opt.value)
          }
        },
        helpText: opt.helpText,
      }))}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
