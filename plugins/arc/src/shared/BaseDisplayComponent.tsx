import { DisplayStatusChrome } from '@jbrowse/display-kit/DisplayChrome'
import { observer } from 'mobx-react'

import type { ArcDisplayModel } from './ArcDisplayModel.ts'

// Arc renders main-thread SVG, so it can't wrap the GPU `DisplayChrome` — that
// one owns `useRenderingBackend`. It renders the same chrome minus the backend
// (`DisplayStatusChrome`): identical container, testid,
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
  const { displayPhase, painted } = model
  return (
    <DisplayStatusChrome
      model={model}
      phase={displayPhase}
      // first-paint signal (arc's `canvasDrawn` analogue), off the model for
      // the same reason `phase` is — see `ArcFetchModel.painted`
      drawn={painted}
      testid="arc-display"
    >
      {children}
    </DisplayStatusChrome>
  )
})

export default BaseDisplayComponent
