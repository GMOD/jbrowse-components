import { Menu } from '@jbrowse/core/ui'

import type { DotplotViewModel } from '../model'

type Coord = [number, number] | undefined

interface SelectionContextMenuProps {
  model: DotplotViewModel
  mouseup: Coord
  mouseupClient: Coord
  mousedown: Coord
  setMouseUpClient: (coord: Coord) => void
  setMouseDownClient: (coord: Coord) => void
  setMouseOvered: (isOvered: boolean) => void
}

function getSelectionMenuItems(
  model: DotplotViewModel,
  mousedown: Coord,
  mouseup: Coord,
  setMouseOvered: (isOvered: boolean) => void,
) {
  return [
    {
      label: 'Zoom in',
      onClick: () => {
        if (mousedown && mouseup) {
          model.zoomInToMouseCoords(mousedown, mouseup)
        }
        // below line is needed to prevent tooltip from sticking
        setMouseOvered(false)
      },
    },
    {
      label: 'Open linear synteny view',
      onClick: () => {
        if (mousedown && mouseup) {
          model.onDotplotView(mousedown, mouseup)
        }
        // below line is needed to prevent tooltip from sticking
        setMouseOvered(false)
      },
    },
  ]
}

export default function SelectionContextMenu({
  model,
  mouseup,
  mouseupClient,
  mousedown,
  setMouseUpClient,
  setMouseDownClient,
  setMouseOvered,
}: SelectionContextMenuProps) {
  return (
    <Menu
      open={Boolean(mouseup)}
      onMenuItemClick={(_, callback) => {
        callback()
        setMouseUpClient(undefined)
        setMouseDownClient(undefined)
      }}
      onClose={() => {
        setMouseUpClient(undefined)
        setMouseDownClient(undefined)
      }}
      anchorReference="anchorPosition"
      anchorPosition={
        mouseupClient
          ? {
              top: mouseupClient[1] + 50,
              left: mouseupClient[0] + 50,
            }
          : undefined
      }
      style={{ zIndex: 800 }}
      menuItems={getSelectionMenuItems(
        model,
        mousedown,
        mouseup,
        setMouseOvered,
      )}
    />
  )
}
