import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { colorByMenuItems, colorByShortLabel } from '@jbrowse/synteny-core'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const { uniformColorBy } = model
  return (
    <CascadingMenuButton
      data-testid="color_by_menu"
      tooltip={
        uniformColorBy
          ? `Color by: ${colorByShortLabel[uniformColorBy]}`
          : 'Color by: mixed'
      }
      menuItems={colorByMenuItems({
        uniformColorBy,
        tracks: model.levels
          .flatMap(l => l.tracks)
          .map(t => {
            const { trackId, name } = t.configuration
            return {
              trackId,
              name,
              colorBy: model.resolveColorBy(trackId),
              overridden: model.trackColorBy.has(trackId),
              trackColor: model.trackColorFor(trackId),
              pinned: model.trackColors.has(trackId),
            }
          }),
        pointBased: false,
        // 'reference' coloring only carries meaning across a stack of >=2
        // levels; for a single-level (two-genome) view it degenerates to
        // query/target
        showReference: model.levels.length > 1,
        showColorLegend: model.showColorLegend,
        setColorBy: value => {
          model.setColorBy(value)
        },
        setTrackColorBy: (trackId, value) => {
          model.setTrackColorBy(trackId, value)
        },
        setTrackColor: (trackId, value) => {
          model.setTrackColor(trackId, value)
        },
        clearTrackColorSettings: () => {
          model.clearTrackColorSettings()
        },
        setShowColorLegend: value => {
          model.setShowColorLegend(value)
        },
      })}
    >
      <PaletteIcon />
    </CascadingMenuButton>
  )
})

export default ColorBySelector
