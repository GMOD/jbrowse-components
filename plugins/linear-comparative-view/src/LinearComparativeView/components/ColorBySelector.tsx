import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { colorBy, opacityByIdentity } = model

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
          label: 'Identity',
          type: 'radio',
          checked: colorBy === 'identity',
          onClick: () => {
            model.setColorBy('identity')
          },
          helpText:
            'Color alignments by sequence identity percentage. Higher identity matches appear in warmer colors, lower identity matches appear cooler. Useful for identifying highly conserved vs divergent regions.',
        },
        {
          label: 'Mean query identity',
          type: 'radio',
          checked: colorBy === 'meanQueryIdentity',
          onClick: () => {
            model.setColorBy('meanQueryIdentity')
          },
          helpText:
            'Color alignments by the length-weighted mean identity across each query/target pair. Aggregates noise from local variations, giving a smoothed view of overall alignment quality across a query contig.',
        },
        {
          label: 'Mapping quality',
          type: 'radio',
          checked: colorBy === 'mappingQuality',
          onClick: () => {
            model.setColorBy('mappingQuality')
          },
          helpText:
            'Color alignments by mapping quality (PAF MAPQ). Higher quality (more confident) mappings appear in warmer colors. Useful for identifying ambiguous or multi-mapping regions.',
        },
        {
          label: 'Fade by identity',
          type: 'checkbox',
          checked: opacityByIdentity,
          onClick: () => {
            model.setOpacityByIdentity(!opacityByIdentity)
          },
          helpText:
            'Modulates ribbon opacity by per-feature sequence identity, independent of the color mode. Low-identity blocks fade out so identity-dropoff zones become visible without consuming the color channel. Combines with any color scheme.',
        },
      ]}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
