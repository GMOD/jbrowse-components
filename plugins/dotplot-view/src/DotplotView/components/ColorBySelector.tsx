import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { ColorBySwatch } from '@jbrowse/synteny-core'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'
import type { SyntenyColorBy } from '@jbrowse/synteny-core'

const COLOR_BY_OPTIONS: readonly {
  value: SyntenyColorBy
  label: string
  helpText: string
}[] = [
  {
    value: 'default',
    label: 'Default',
    helpText:
      'Draw all alignments in black, the conventional dotplot line color.',
  },
  {
    value: 'identity',
    label: 'Identity',
    helpText:
      'Color alignments by per-alignment sequence identity on a perceptually-uniform viridis scale: low identity is dark purple, high identity is bright yellow. Useful for distinguishing divergent vs. conserved regions.',
  },
  {
    value: 'meanQueryIdentity',
    label: 'Mean query identity',
    helpText:
      'Color by the length-weighted mean sequence identity across all alignments of each query/target pair (a true 0–100% value). A single long query split into many smaller hits is colored by its overall identity to the target. Similar to the program dotPlotly.',
  },
  {
    value: 'meanQueryMappingQuality',
    label: 'Mean query mapping quality',
    helpText:
      'Color by the length-weighted mean mapping quality (MAPQ) per query/target pair, normalized across pairs to highlight relatively strong vs. weak synteny (e.g. polyploidy). Based on the dotPlotly weighted-mean method.',
  },
  {
    value: 'mappingQuality',
    label: 'Mapping quality',
    helpText:
      'Color alignments by per-alignment PAF mapping quality (MAPQ, 0–60) on a perceptually-uniform cividis scale: low MAPQ dark blue, high MAPQ yellow. Useful for identifying ambiguous or multi-mapping regions.',
  },
  {
    value: 'strand',
    label: 'Strand',
    helpText:
      'Color alignments by strand orientation. Forward and reverse strand alignments use different colors, making inversions and strand-specific patterns easy to spot.',
  },
  {
    value: 'query',
    label: 'Query',
    helpText:
      "Color by the query sequence (this assembly's own refName). Each unique sequence gets a consistent color, making it easy to distinguish different contigs/chromosomes.",
  },
  {
    value: 'target',
    label: 'Target',
    helpText:
      "Color by the target/mate sequence (the other assembly's refName). The complement of Query coloring — useful when one query maps across several targets.",
  },
]

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: DotplotViewModel
}) {
  const { dotplotDisplays, showColorLegend } = model
  const colorBy = dotplotDisplays[0]?.colorBy ?? 'default'

  return (
    <CascadingMenuButton
      menuItems={[
        ...COLOR_BY_OPTIONS.map(opt => ({
          label: (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                justifyContent: 'space-between',
              }}
            >
              {opt.label}
              <ColorBySwatch colorBy={opt.value} />
            </span>
          ),
          type: 'radio' as const,
          checked: colorBy === opt.value,
          onClick: () => {
            for (const d of dotplotDisplays) {
              d.setColorBy(opt.value)
            }
          },
          helpText: opt.helpText,
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
