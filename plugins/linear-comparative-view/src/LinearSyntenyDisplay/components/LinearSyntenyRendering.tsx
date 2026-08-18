import {
  ComparativeFetchStatus,
  ComparativeTooltip,
} from '@jbrowse/synteny-core'
import { observer } from 'mobx-react'

import SyntenyContextMenu from './SyntenyContextMenu.tsx'

import type { LinearSyntenyDisplayModel } from '../model.ts'

// Per-display overlays. Canvas and unified ErrorBanner live in
// LevelSyntenyCanvas.
const LinearSyntenyRendering = observer(function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { tooltipLines, contextMenuAnchor } = model

  return (
    <>
      {/* First load gets the full striped overlay, a refetch the corner chip —
          shared with dotplot so the two views can't show different things for
          the same state. */}
      <ComparativeFetchStatus display={model} />
      {tooltipLines ? <ComparativeTooltip lines={tooltipLines} /> : null}
      {contextMenuAnchor ? (
        <SyntenyContextMenu
          model={model}
          anchorEl={contextMenuAnchor}
          onClose={() => {
            model.closeContextMenu()
          }}
        />
      ) : null}
    </>
  )
})

export default LinearSyntenyRendering
