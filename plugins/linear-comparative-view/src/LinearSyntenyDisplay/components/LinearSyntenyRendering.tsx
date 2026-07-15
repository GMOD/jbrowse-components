import { LoadingOverlay } from '@jbrowse/core/ui'
import { RefetchIndicator } from '@jbrowse/synteny-core'
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
  const {
    tooltipText,
    statusMessage,
    statusProgress,
    loading,
    refetching,
    contextMenuAnchor,
  } = model

  return (
    <>
      {/* First load: full striped overlay with the determinate progress bar. */}
      <LoadingOverlay
        statusMessage={statusMessage}
        progress={statusProgress}
        isVisible={loading}
        immediate
      />
      {/* Refetch: stale ribbons stay on screen, so a small shared corner chip
          carries the same statusCallback message + determinate fraction. */}
      {refetching ? (
        <RefetchIndicator
          statusMessage={statusMessage}
          statusProgress={statusProgress}
        />
      ) : null}
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
