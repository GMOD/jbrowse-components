import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import { Button } from '@mui/material'

import { moveDown, moveUp } from '../sourcesGridUtils.ts'

import type { GridRowId } from '@mui/x-data-grid'

export default function SelectionMoveButtons<T extends { name: string }>({
  rows,
  selected,
  onChange,
  showTips,
}: {
  rows: T[]
  selected: GridRowId[]
  onChange: (arg: T[]) => void
  showTips: boolean
}) {
  const disabled = !selected.length
  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => {
          onChange(moveUp([...rows], selected))
        }}
      >
        <KeyboardArrowUpIcon />
        {showTips ? 'Move selected items up' : null}
      </Button>
      <Button
        disabled={disabled}
        onClick={() => {
          onChange(moveDown([...rows], selected))
        }}
      >
        <KeyboardArrowDownIcon />
        {showTips ? 'Move selected items down' : null}
      </Button>
      <Button
        disabled={disabled}
        onClick={() => {
          onChange(moveUp([...rows], selected, rows.length))
        }}
      >
        <KeyboardDoubleArrowUpIcon />
        {showTips ? 'Move selected items to top' : null}
      </Button>
      <Button
        disabled={disabled}
        onClick={() => {
          onChange(moveDown([...rows], selected, rows.length))
        }}
      >
        <KeyboardDoubleArrowDownIcon />
        {showTips ? 'Move selected items to bottom' : null}
      </Button>
    </>
  )
}
