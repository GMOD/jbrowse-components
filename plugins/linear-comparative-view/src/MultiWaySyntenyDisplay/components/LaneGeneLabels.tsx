import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { FloatingText } from '@jbrowse/display-ui'
import { bandGroundColor, bandInk } from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import { GENE_LABEL_FONT_PX } from '../laneLabels.ts'
import { drawnPx, laneMapOf } from '../multiwayRenderTypes.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

// a pan moves the offset alone, so placement stays out of the offset's observer
const PlacedLabels = observer(function PlacedLabels({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { fontFamily } = useStyleTheme().typography
  const { scrollTop } = model
  return model
    .laneGeneLabels(fontFamily, model.pinnedLabelGroups)
    .map(label => (
      <FloatingText
        key={label.key}
        data-testid="multiway-gene-label"
        x={drawnPx(laneMapOf(model, label.row), label.left)}
        y={label.top - scrollTop}
        color={bandInk().text}
        fontSize={GENE_LABEL_FONT_PX}
        halo={bandGroundColor()}
        style={label.pinned ? { fontWeight: 'bold' } : undefined}
      >
        {label.text}
      </FloatingText>
    ))
})

const LaneGeneLabels = observer(function LaneGeneLabels({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  return (
    <div
      data-testid="multiway-gene-labels"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: model.canvasWidth,
        height: model.height,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateX(${model.dragOffsetPx}px)`,
        }}
      >
        <PlacedLabels model={model} />
      </div>
    </div>
  )
})

export default LaneGeneLabels
