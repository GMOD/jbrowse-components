import { FloatingText } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { GENE_LABEL_FONT_PX } from '../laneLabels.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

const LaneLayerTitles = observer(function LaneLayerTitles({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { scrollTop } = model
  return model.laneLayerTitles.map(title => (
    <FloatingText
      key={title.key}
      data-testid="multiway-layer-title"
      x={4}
      y={title.top - scrollTop}
      color={bandInk().text}
      fontSize={GENE_LABEL_FONT_PX}
      halo={bandGroundColor()}
    >
      {title.text}
    </FloatingText>
  ))
})

export default LaneLayerTitles
