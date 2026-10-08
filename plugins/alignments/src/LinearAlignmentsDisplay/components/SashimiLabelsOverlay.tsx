import { observer } from 'mobx-react'

import SashimiLabels from './SashimiLabels.tsx'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

// The junction read counts over the canvas the arcs draw on. The canvas
// underneath answers the hover and the click.
const SashimiLabelsOverlay = observer(function SashimiLabelsOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const labels = model.sashimiLabels
  return labels.length === 0 ? null : (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: model.height,
        pointerEvents: 'none',
      }}
    >
      <SashimiLabels labels={labels} />
    </svg>
  )
})

export default SashimiLabelsOverlay
