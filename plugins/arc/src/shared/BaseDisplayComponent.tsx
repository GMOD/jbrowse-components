import { DisplayStatusChrome } from '@jbrowse/plugin-linear-genome-view'
import { observer } from 'mobx-react'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

// Arc renders main-thread SVG, so it can't wrap the GPU `DisplayChrome` — that
// one owns `useRenderingBackend`. It renders the same chrome minus the backend
// (`DisplayStatusChrome`): identical container, `-done` testid,
// `data-display-phase`, banners and background-progress chip, from one
// implementation rather than two that agree today. Arc supplies only the two
// facts the harness can't have for a display whose canvas it doesn't own — the
// phase (off the model, so a component can't disagree with it) and first paint.
//
// Arc used to hand-assemble that subtree from the individual banner components,
// which is precisely how it became the one display with no background-progress
// chip.
const BaseDisplayComponent = observer(function BaseDisplayComponent({
  model,
  children,
}: {
  model: ArcDisplayModel
  children?: React.ReactNode
}) {
  const { error, features, displayPhase } = model
  return (
    <DisplayStatusChrome
      model={model}
      phase={displayPhase}
      // first-paint signal (arc's `canvasDrawn` analogue): stays true across a
      // refetch so the `-done` testid and the loading anti-flash don't churn on
      // pan. The stricter, stale-aware `model.svgReady` is the export gate.
      drawn={features !== undefined || !!error}
      testid="arc-display"
    >
      {children}
    </DisplayStatusChrome>
  )
})

export default BaseDisplayComponent
