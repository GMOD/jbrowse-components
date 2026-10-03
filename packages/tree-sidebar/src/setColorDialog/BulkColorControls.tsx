import { useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { updateRows } from '../sourcesGridUtils.ts'

import type { GridRowId } from '@mui/x-data-grid'

// Bulk header button + its popover for the rows' colour. The popover portals
// via MUI Popover, so rendering it as a sibling of the button is fine.
export default observer(function BulkColorControls<
  S extends { name: string; rowColor?: string },
>({
  editsColor,
  rows,
  selected,
  onChange,
}: {
  editsColor: boolean
  rows: S[]
  selected: GridRowId[]
  onChange: (arg: S[]) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [widgetColor, setWidgetColor] = useState('blue')

  return editsColor ? (
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
          onChange(
            updateRows(rows, selected, { rowColor: value } as Partial<S>),
          )
        }}
        onClose={() => {
          setAnchorEl(null)
        }}
      />
    </>
  ) : null
})
