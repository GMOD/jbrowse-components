import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { colorByMenuItems } from '@jbrowse/synteny-core'
import PaletteIcon from '@mui/icons-material/Palette'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const ColorBySelector = observer(function ColorBySelector({
  model,
}: {
  model: DotplotViewModel
}) {
  return (
    <CascadingMenuButton
      data-testid="color_by_menu"
      menuItems={colorByMenuItems({
        uniformColorBy: model.uniformColorBy,
        tracks: model.tracks.map(t => {
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
        pointBased: true,
        // the dotplot compares exactly two genomes, so there is no third
        // assembly for 'reference' to anchor on
        showReference: false,
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
