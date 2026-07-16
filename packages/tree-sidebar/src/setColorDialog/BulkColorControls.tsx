import { useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { updateRows } from '../sourcesGridUtils.ts'

import type { ColorColumn } from './SourceGrid.tsx'
import type { GridRowId } from '@mui/x-data-grid'

// Bulk header button + its popover for the active color column. The popover
// portals via MUI Popover, so rendering it as a sibling of the button is fine.
export default observer(function BulkColorControls<
  S extends { name: string; color?: string },
>({
  colorColumn,
  rows,
  selected,
  onChange,
}: {
  colorColumn: ColorColumn<S> | undefined
  rows: S[]
  selected: GridRowId[]
  onChange: (arg: S[]) => void
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [widgetColor, setWidgetColor] = useState('blue')

  return colorColumn ? (
    <>
      <Button
        variant="contained"
        disabled={!selected.length}
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
        {colorColumn.bulkLabel ??
          `Change ${colorColumn.headerName.toLowerCase()} of selected`}
      </Button>
      <ColorPopover
        anchorEl={anchorEl}
        color={widgetColor}
        onChange={value => {
          setWidgetColor(value)
          onChange(
            updateRows(rows, selected, {
              [colorColumn.field]: value,
            } as Partial<S>),
          )
        }}
        onClose={() => {
          setAnchorEl(null)
        }}
      />
    </>
  ) : null
})
