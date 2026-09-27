import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { FloatingText } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { GENE_LABEL_FONT_PX } from '../laneLabels.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

const LaneLayerTitles = observer(function LaneLayerTitles({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { palette } = useStyleTheme()
  const { scrollTop } = model
  return model.laneLayerTitles.map(title => (
    <FloatingText
      key={title.key}
      data-testid="multiway-layer-title"
      x={4}
      y={title.top - scrollTop}
      color={palette.text.secondary}
      fontSize={GENE_LABEL_FONT_PX}
      halo={palette.background.paper}
    >
      {title.text}
    </FloatingText>
  ))
})

export default LaneLayerTitles
