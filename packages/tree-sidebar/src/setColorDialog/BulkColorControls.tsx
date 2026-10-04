import { useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { Button } from '@mui/material'

import type { GridRowId } from '@mui/x-data-grid'

// Bulk header button + its popover for the selected rows' colour. The popover
// portals via MUI Popover, so rendering it as a sibling of the button is fine.
export default function BulkColorControls({
  selected,
  onPick,
}: {
  selected: GridRowId[]
  onPick: (picked: ReadonlyMap<string, string>) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [widgetColor, setWidgetColor] = useState('blue')

  return (
    <>
      <Button
        variant="contained"
        disabled={!selected.length}
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
        Change color of selected rows
      </Button>
      <ColorPopover
        anchorEl={anchorEl}
        color={widgetColor}
        onChange={value => {
          setWidgetColor(value)
          onPick(new Map(selected.map(id => [String(id), value])))
        }}
        onClose={() => {
          setAnchorEl(null)
        }}
      />
    </>
  )
}
