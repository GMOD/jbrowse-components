import { lazy } from 'react'

import { ErrorMessage, LoadingOverlay } from '@jbrowse/core/ui'
import { observer } from 'mobx-react'

import SyntenyContextMenu from './SyntenyContextMenu.tsx'

import type { LinearSyntenyDisplayModel } from '../model.ts'

const SyntenyTooltip = lazy(() => import('./SyntenyTooltip.tsx'))

// Overlay-only view of a synteny display. The canvas is owned by the
// containing level (LevelSyntenyCanvas); this component layers tooltip /
// context menu / loading UI on top.
const LinearSyntenyRendering = observer(function LinearSyntenyRendering({
  model,
}: {
  model: LinearSyntenyDisplayModel
}) {
  const { tooltipText, statusMessage, ready, error, contextMenuAnchor } = model

  return (
    <>
      {error ? <ErrorMessage error={error} /> : null}
      <LoadingOverlay statusMessage={statusMessage} isVisible={!ready} />
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
