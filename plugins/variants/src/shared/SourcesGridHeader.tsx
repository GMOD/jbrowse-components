import { useState } from 'react'

import { ColorPopover } from '@jbrowse/core/ui/ColorPicker'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import { Button } from '@mui/material'

import { moveDown, moveUp } from './util'

import type { Source } from '../types'

export default function SourcesGridHeader({
  selected,
  onChange,
  rows,
  showTips,
}: {
  onChange: (arg: Source[]) => void
  rows: Source[]
  selected: string[]
  showTips: boolean
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [widgetColor, setWidgetColor] = useState('blue')
  return (
    <>
      <Button
        disabled={!selected.length}
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      >
        Change color of selected items
      </Button>
      <Button
        onClick={() => {
          onChange(moveUp([...rows], selected))
        }}
        disabled={!selected.length}
      >
        <KeyboardArrowUpIcon />
        {showTips ? 'Move selected items up' : null}
      </Button>
      <Button
        onClick={() => {
          onChange(moveDown([...rows], selected))
        }}
        disabled={!selected.length}
      >
        <KeyboardArrowDownIcon />
        {showTips ? 'Move selected items down' : null}
      </Button>
      <Button
        onClick={() => {
          onChange(moveUp([...rows], selected, rows.length))
        }}
        disabled={!selected.length}
      >
        <KeyboardDoubleArrowUpIcon />
        {showTips ? 'Move selected items to top' : null}
      </Button>
      <Button
        onClick={() => {
          onChange(moveDown([...rows], selected, rows.length))
        }}
        disabled={!selected.length}
      >
        <KeyboardDoubleArrowDownIcon />
        {showTips ? 'Move selected items to bottom' : null}
      </Button>
      <ColorPopover
        anchorEl={anchorEl}
        color={widgetColor}
        onChange={c => {
          setWidgetColor(c)
          selected.forEach(id => {
            const elt = rows.find(f => f.name === id)
            if (elt) {
              elt.color = c
            }
          })

          onChange([...rows])
        }}
        onClose={() => {
          setAnchorEl(null)
        }}
      />
    </>
  )
}
