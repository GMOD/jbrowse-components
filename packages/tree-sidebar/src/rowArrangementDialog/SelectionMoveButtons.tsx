import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import { IconButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { moveDown, moveUp } from '../sourcesGridUtils.ts'

import type { GridRowId } from '@mui/x-data-grid'

export default observer(function SelectionMoveButtons<
  T extends { name: string },
>({
  rows,
  selected,
  onChange,
}: {
  rows: T[]
  selected: GridRowId[]
  onChange: (arg: T[]) => void
}) {
  const disabled = !selected.length
  return (
    <>
      <Tooltip title="Move selected items up">
        <span>
          <IconButton
            aria-label="Move selected items up"
            disabled={disabled}
            onClick={() => {
              onChange(moveUp(rows, selected))
            }}
          >
            <KeyboardArrowUpIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Move selected items down">
        <span>
          <IconButton
            aria-label="Move selected items down"
            disabled={disabled}
            onClick={() => {
              onChange(moveDown(rows, selected))
            }}
          >
            <KeyboardArrowDownIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Move selected items to top">
        <span>
          <IconButton
            aria-label="Move selected items to top"
            disabled={disabled}
            onClick={() => {
              onChange(moveUp(rows, selected, rows.length))
            }}
          >
            <KeyboardDoubleArrowUpIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Move selected items to bottom">
        <span>
          <IconButton
            aria-label="Move selected items to bottom"
            disabled={disabled}
            onClick={() => {
              onChange(moveDown(rows, selected, rows.length))
            }}
          >
            <KeyboardDoubleArrowDownIcon />
          </IconButton>
        </span>
      </Tooltip>
    </>
  )
})
