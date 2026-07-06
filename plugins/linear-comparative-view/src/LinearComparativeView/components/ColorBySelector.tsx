import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

// Flat list, ordered so related modes sit together: structural colorings
// first, then the identity ramps, then the mapping-quality ramps.
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
    label: 'Reference',
    value: 'reference',
    helpText:
      "Color every level by the shared reference assembly's chromosome names, so a region keeps one consistent color as it's traced across all levels of a stacked multi-genome view.",
  },
  {
    label: 'Identity',
    value: 'identity',
    helpText:
      'Color by per-alignment sequence identity on a perceptually-uniform viridis scale: low identity is dark purple, high identity is bright yellow. Useful for distinguishing divergent vs conserved regions.',
  },
  {
    label: 'Mean query identity',
    value: 'meanQueryIdentity',
    helpText:
      'Color by the length-weighted mean sequence identity across all alignments of each query/target pair (a true 0–100% value). Smooths local noise — e.g. a contig split into many hits is colored by its overall identity to the target.',
  },
  {
    label: 'Mapping quality',
    value: 'mappingQuality',
    helpText:
      'Color by per-alignment PAF mapping quality (MAPQ, 0–60) on a perceptually-uniform cividis scale: low MAPQ dark blue, high MAPQ yellow. Highlights ambiguous or multi-mapping regions.',
  },
  {
    label: 'Mean query mapping quality',
    value: 'meanQueryMappingQuality',
    helpText:
      'Color by the length-weighted mean mapping quality (MAPQ) per query/target pair, normalized across pairs to highlight relatively strong vs weak synteny (e.g. polyploidy). Based on the dotPlotly weighted-mean method.',
  },
] as const

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { colorBy, showColorLegend } = model

  // 'reference' coloring only carries meaning across a stack of ≥2 levels;
  // for a single-level (two-genome) view it degenerates to query/target, so
  // hide it there to keep the menu focused.
  const modes = COLOR_MODES.filter(
    m => m.value !== 'reference' || model.levels.length > 1,
  )
  const active = COLOR_MODES.find(m => m.value === colorBy)

  return (
    <CascadingMenuButton
      tooltip={active ? `Color by: ${active.label}` : 'Color by'}
      menuItems={[
        ...modes.map(({ label, value, helpText }) => ({
          label,
          type: 'radio' as const,
          checked: colorBy === value,
          helpText,
          onClick: () => {
            model.setColorBy(value)
          },
        })),
        {
          label: 'Show color legend',
          type: 'checkbox' as const,
          checked: showColorLegend,
          onClick: () => {
            model.setShowColorLegend(!showColorLegend)
          },
        },
      ]}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
