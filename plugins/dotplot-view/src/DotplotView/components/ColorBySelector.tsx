import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { DotplotDisplayModel } from '../../DotplotDisplay/stateModelFactory'
import type { DotplotViewModel } from '../model'

const ColorBySelector = observer(function ({
  model,
}: {
  model: DotplotViewModel
}) {
  // Get the first display from the first track (if it exists)
  const firstDisplay = model.tracks[0]?.displays[0] as
    | DotplotDisplayModel
    | undefined

  const colorBy = firstDisplay?.colorBy ?? 'default'

  const setColorBy = (value: string) => {
    // Set colorBy for all displays across all tracks
    for (const track of model.tracks) {
      for (const display of track.displays) {
        ;(display as DotplotDisplayModel).setColorBy(value)
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
          onClick: () => {
            setColorBy('default')
          },
          helpText:
            'Use the default color scheme specified in the track configuration. This respects the color settings defined in the config file.',
        },
        {
          label: 'Identity',
          type: 'radio',
          checked: colorBy === 'identity',
          onClick: () => {
            setColorBy('identity')
          },
          helpText:
            'Color alignments by sequence identity percentage. Higher identity matches appear in warmer colors, while lower identity matches appear cooler. Useful for identifying highly conserved vs. divergent regions.',
        },
        {
          label: 'Mean Query Identity',
          type: 'radio',
          checked: colorBy === 'meanQueryIdentity',
          onClick: () => {
            setColorBy('meanQueryIdentity')
          },
          helpText:
            'Color alignments based on the mean identity across the query sequence. This provides a smoothed view of overall alignment quality, reducing noise from local variations. For instance, a single long query of e.g. a contig of an assembly, when aligned to the target, may get split into many smaller "hits". This score aggregates across them, and colors them all the same. Similar code exists in the program dotPlotly',
        },
        {
          label: 'Mapping Quality',
          type: 'radio',
          checked: colorBy === 'mappingQuality',
          onClick: () => {
            setColorBy('mappingQuality')
          },
          helpText:
            'Color alignments by mapping quality score (MAPQ). Higher quality mappings (more unique/confident) appear in darker colors. Useful for identifying ambiguous or multi-mapping regions.',
        },
        {
          label: 'Strand',
          type: 'radio',
          checked: colorBy === 'strand',
          onClick: () => {
            setColorBy('strand')
          },
          helpText:
            'Color alignments by strand orientation. Forward strand alignments and reverse strand alignments are shown in different colors, making it easy to identify inversions and strand-specific patterns.',
        },
        {
          label: 'Query',
          type: 'radio',
          checked: colorBy === 'query',
          onClick: () => {
            setColorBy('query')
          },
          helpText:
            'Color alignments by query sequence name. Each unique query sequence is assigned a consistent color based on its name, making it easy to visually distinguish between different sequences.',
        },
      ]}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
