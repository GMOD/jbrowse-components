import { LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SyntenyContextMenu from './SyntenyContextMenu.tsx'
import SyntenyTooltip from './SyntenyTooltip.tsx'

import type { LinearSyntenyDisplayModel } from '../model.ts'

// Per-display overlays. Canvas and unified ErrorBanner live in
// LevelSyntenyCanvas.
const LinearSyntenyRendering = observer(function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { tooltipText, statusMessage, statusProgress, loading, contextMenuAnchor } =
    model

  return (
    <>
      <LoadingOverlay
        statusMessage={statusMessage}
        progress={statusProgress}
        isVisible={loading}
      />
      {tooltipText ? <SyntenyTooltip title={tooltipText} /> : null}
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
