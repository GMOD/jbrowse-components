import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const COLOR_MODES = [
  {
    label: 'Default',
    value: 'default',
    helpText:
      'Default ribbon color (red) with CIGAR operation coloring — insertions, deletions, and skips drawn in distinct colors over the alignment.',
  },
  {
    label: 'Strand',
    value: 'strand',
    helpText:
      'Color alignments by strand orientation. Forward and reverse strand alignments use different colors, making inversions and strand-specific patterns easy to spot.',
  },
  {
    label: 'Query',
    value: 'query',
    helpText:
      "Color by the query sequence (this assembly's own refName). Each unique sequence gets a consistent color, making it easy to distinguish different contigs/chromosomes.",
  },
  {
    label: 'Target',
    value: 'target',
    helpText:
      "Color by the target/mate sequence (the other assembly's refName). The complement of Query coloring — useful when one query maps across several targets.",
  },
  {
    label: 'Identity',
    value: 'identity',
    helpText:
      'Color by per-alignment sequence identity on a perceptually-uniform viridis scale: low identity is dark purple, high identity is bright yellow. Useful for distinguishing divergent vs conserved regions.',
  },
  {
    label: 'Identity (diverging)',
    value: 'identityDiverging',
    helpText:
      'Per-alignment identity on a colorblind-safe diverging scale pivoted near 90%: divergent regions read warm/red, conserved regions cool/blue. Expands the high-identity range where synteny alignments cluster.',
  },
  {
    label: 'Mean query identity',
    value: 'meanQueryIdentity',
    helpText:
      'Color by the length-weighted mean sequence identity across all alignments of each query/target pair (a true 0–100% value). Smooths local noise — e.g. a contig split into many hits is colored by its overall identity to the target.',
  },
  {
    label: 'Mean query mapping quality',
    value: 'meanQueryMappingQuality',
    helpText:
      'Color by the length-weighted mean mapping quality (MAPQ) per query/target pair, normalized across pairs to highlight relatively strong vs weak synteny (e.g. polyploidy). Based on the dotPlotly weighted-mean method.',
  },
  {
    label: 'Mapping quality',
    value: 'mappingQuality',
    helpText:
      'Color by per-alignment PAF mapping quality (MAPQ, 0–60) on a perceptually-uniform cividis scale: low MAPQ dark blue, high MAPQ yellow. Highlights ambiguous or multi-mapping regions.',
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
