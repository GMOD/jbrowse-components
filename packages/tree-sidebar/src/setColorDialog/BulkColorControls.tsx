import { Fragment, useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import { Button } from '@mui/material'

import { updateRows } from '../sourcesGridUtils.ts'

import type { ColorColumn } from './SourceGrid.tsx'
import type { GridRowId } from '@mui/x-data-grid'

// Bulk header buttons + their popovers for each color column. Popovers portal
// via MUI Popover so rendering them as siblings of the buttons is fine.
export default function BulkColorControls<
  S extends { name: string; color?: string },
>({
  colorColumns,
  rows,
  selected,
  onChange,
}: {
  colorColumns: ColorColumn<S>[]
  rows: S[]
  selected: GridRowId[]
  onChange: (arg: S[]) => void
}) {
  const [anchorByField, setAnchorByField] = useState<
    Record<string, HTMLElement | null>
  >({})
  const [widgetColorByField, setWidgetColorByField] = useState<
    Record<string, string>
  >({})
  const disabled = !selected.length

  return (
    <>
      {colorColumns.map(c => (
        <Fragment key={c.field}>
          <Button
            variant="contained"
            disabled={disabled}
            onClick={event => {
              setAnchorByField(prev => ({
                ...prev,
                [c.field]: event.currentTarget,
              }))
            }}
          >
            {c.bulkLabel ?? `Change ${c.headerName.toLowerCase()} of selected`}
          </Button>
          <ColorPopover
            anchorEl={anchorByField[c.field] ?? null}
            color={widgetColorByField[c.field] ?? 'blue'}
            onChange={value => {
              setWidgetColorByField(prev => ({ ...prev, [c.field]: value }))
              onChange(
                updateRows(rows, selected, { [c.field]: value } as Partial<S>),
              )
            }}
            onClose={() => {
              setAnchorByField(prev => ({ ...prev, [c.field]: null }))
            }}
          />
        </Fragment>
      ))}
    </>
  )
}
