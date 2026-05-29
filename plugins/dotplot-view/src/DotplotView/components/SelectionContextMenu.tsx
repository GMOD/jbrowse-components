import { Menu } from '@jbrowse/core/ui'

import type { DotplotInteraction } from './useDotplotInteraction.ts'
import type { DotplotViewModel } from '../model.ts'

export default function SelectionContextMenu({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const {
    mouseup,
    mouseupClient,
    mousedown,
    setMouseUpClient,
    setMouseDownClient,
    setMouseOvered,
  } = interaction
  const close = () => {
    setMouseUpClient(undefined)
    setMouseDownClient(undefined)
  }
  // unhover prevents the tooltip from sticking after the menu closes; the
  // selection itself is cleared by close() via onMenuItemClick/onClose.
  const unhover = () => {
    setMouseOvered(false)
  }
  return (
    <Menu
      open={Boolean(mouseup)}
      onMenuItemClick={(_, callback) => {
        callback()
        close()
      }}
      onClose={() => {
        close()
      }}
      anchorReference="anchorPosition"
      anchorPosition={
        mouseupClient
          ? { top: mouseupClient[1] + 50, left: mouseupClient[0] + 50 }
          : undefined
      }
      style={{ zIndex: 11000 }}
      menuItems={[
        {
          label: 'Zoom in',
          onClick: () => {
            if (mousedown && mouseup) {
              model.zoomInToMouseCoords(mousedown, mouseup)
            }
            unhover()
          },
        },
        {
          label: 'Open linear synteny view',
          onClick: () => {
            if (mousedown && mouseup) {
              model.onDotplotView(mousedown, mouseup)
            }
            unhover()
          },
        },
      ]}
    />
  )
}
