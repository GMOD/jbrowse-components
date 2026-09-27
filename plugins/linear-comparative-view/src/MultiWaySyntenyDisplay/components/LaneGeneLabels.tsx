import { useStyleTheme } from '@jbrowse/core/ui/PaletteContext'
import { FloatingText } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import { GENE_LABEL_FONT_PX } from '../laneLabels.ts'

import type { MultiWaySyntenyDisplayModel } from '../model.ts'

const LaneGeneLabels = observer(function LaneGeneLabels({
  model,
}: {
  model: MultiWaySyntenyDisplayModel
}) {
  const { palette, typography } = useStyleTheme()
  const { fontFamily } = typography
  const { scrollTop } = model
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
      {model.laneGeneLabels(fontFamily, model.pinnedLabelGroups).map(label => (
        <FloatingText
          key={label.key}
          data-testid="multiway-gene-label"
          x={label.left}
          y={label.top - scrollTop}
          color={palette.text.primary}
          fontSize={GENE_LABEL_FONT_PX}
          halo={palette.background.paper}
          style={label.pinned ? { fontWeight: 'bold' } : undefined}
        >
          {label.text}
        </FloatingText>
      ))}
    </div>
  )
})

export default LaneGeneLabels
