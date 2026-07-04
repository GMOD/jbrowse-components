import { observer } from 'mobx-react'

import MafLegend from './MafLegend.tsx'
import { identityColor } from './drawRowIdentity.ts'

import type { LinearMafDisplayModel } from '../stateModel.ts'

// Endpoints of the same red→grey→blue ramp the rows are painted with, so the
// legend swatches match the rendering exactly.
const rgb = (t: number) => {
  const [r, g, b] = identityColor(t)
  return `rgb(${r},${g},${b})`
}

/**
 * Legend for the per-row identity modes (heatmap / X-Y plot): the diverging ramp
 * where red = divergent (low % identity to the reference) and blue = conserved
 * (high % identity). Answers "what do the row colors mean?" without leaving the
 * view. Renders only while an identity mode is the active row rendering.
 */
const MafIdentityLegend = observer(function MafIdentityLegend({
  model,
}: {
  model: LinearMafDisplayModel
}) {
  const { activeRowRendering } = model
  if (activeRowRendering !== 'heatmap' && activeRowRendering !== 'xyplot') {
    return null
  }
  return (
    <MafLegend
      entries={[
        // header (no swatch) names the metric so the ramp isn't ambiguous
        { label: 'Per-base identity to reference' },
        { label: 'Conserved (base matches)', color: rgb(1) },
        { label: 'Divergent (base differs)', color: rgb(0) },
      ]}
    />
  )
})

export default MafIdentityLegend
